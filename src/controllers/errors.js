'use strict';

var nconf = require('nconf');
var winston = require('winston');
var validator = require('validator');
var plugins = require('../plugins');

exports.handleURIErrors = function (err, req, res, next) {
	// Handle cases where malformed URIs are passed in
	if (err instanceof URIError) {
		var tidMatch = req.path.match(/^\/topic\/(\d+)\//);
		var cidMatch = req.path.match(/^\/category\/(\d+)\//);

		if (tidMatch) {
			res.redirect(nconf.get('relative_path') + tidMatch[0]);
		} else if (cidMatch) {
			res.redirect(nconf.get('relative_path') + cidMatch[0]);
		} else {
			winston.warn('[controller] Bad request: ' + req.path);
			if (req.path.startsWith(nconf.get('relative_path') + '/api')) {
				res.status(400).json({
					error: '[[global:400.title]]',
				});
			} else {
				var middleware = require('../middleware');
				middleware.buildHeader(req, res, function () {
					res.status(400).render('400', { error: validator.escape(String(err.message)) });
				});
			}
		}
	} else {
		next(err);
	}
};

// this needs to have four arguments or express treats it as `(req, res, next)`
// don't remove `next`!
exports.handleErrors = function (err, req, res, next) { // eslint-disable-line no-unused-vars
	var cases = {
		EBADCSRFTOKEN: function () {
			winston.error(req.path + '\n', err.message);
			res.sendStatus(403);
		},
		'blacklisted-ip': function () {
			res.status(403).type('text/plain').send(err.message);
		},
	};
	var defaultHandler = function () {
		// Display NodeBB error page
		var status = parseInt(err.status, 10);
		if ((status === 302 || status === 308) && err.path) {
			return res.locals.isAPI ? res.set('X-Redirect', err.path).status(200).json(err.path) : res.redirect(err.path);
		}

		winston.error(req.path + '\n', err.stack);

		res.status(status || 500);

		var path = String(req.path || '');
		if (res.locals.isAPI) {
			res.json({ path: validator.escape(path), error: err.message });
		} else {
			var middleware = require('../middleware');
			middleware.buildHeader(req, res, function () {
				res.render('500', { path: validator.escape(path), error: validator.escape(String(err.message)) });
			});
		}
	};

	plugins.fireHook('filter:error.handle', {
		cases: cases,
	}, function (_err, data) {
		if (_err) {
			// Assume defaults
			winston.warn('[errors/handle] Unable to retrieve plugin handlers for errors: ' + _err.message);
			data.cases = cases;
		}

		if (data.cases.hasOwnProperty(err.code)) {
			data.cases[err.code](err, req, res, defaultHandler);
		} else {
			defaultHandler();
		}
	});
};
