'use strict';

const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');
const plugins = require('../plugins');
const middleware = require('../middleware');

exports.handleURIErrors = async function handleURIErrors(err, req, res, next) {
	// Handle cases where malformed URIs are passed in
	if (err instanceof URIError) {
		const cleanPath = req.path.replace(new RegExp(`^${nconf.get('relative_path')}`), '');
		const tidMatch = cleanPath.match(/^\/topic\/(\d+)\//);
		const cidMatch = cleanPath.match(/^\/category\/(\d+)\//);

		if (tidMatch) {
			res.redirect(nconf.get('relative_path') + tidMatch[0]);
		} else if (cidMatch) {
			res.redirect(nconf.get('relative_path') + cidMatch[0]);
		} else {
			winston.warn(`[controller] Bad request: ${req.path}`);
			if (req.path.startsWith(`${nconf.get('relative_path')}/api`)) {
				res.status(400).json({
					error: '[[global:400.title]]',
				});
			} else {
				await middleware.buildHeaderAsync(req, res);
				res.status(400).render('400', { error: validator.escape(String(err.message)) });
			}
		}
	} else {
		next(err);
	}
};

// this needs to have four arguments or express treats it as `(req, res, next)`
// don't remove `next`!
exports.handleErrors = function handleErrors(err, req, res, next) { // eslint-disable-line no-unused-vars
	const cases = {
		EBADCSRFTOKEN: function () {
			winston.error(`${req.path}\n${err.message}`);
			res.sendStatus(403);
		},
		'blacklisted-ip': function () {
			res.status(403).type('text/plain').send(err.message);
		},
	};
	const defaultHandler = async function () {
		// Display NodeBB error page
		const status = parseInt(err.status, 10);
		if ((status === 302 || status === 308) && err.path) {
			return res.locals.isAPI ? res.set('X-Redirect', err.path).status(200).json(err.path) : res.redirect(nconf.get('relative_path') + err.path);
		}

		winston.error(`${req.path}\n${err.stack}`);

		res.status(status || 500);

		const path = String(req.path || '');
		if (res.locals.isAPI) {
			res.json({ path: validator.escape(path), error: err.message });
		} else {
			await middleware.buildHeaderAsync(req, res);
			res.render('500', { path: validator.escape(path), error: validator.escape(String(err.message)) });
		}
	};

	plugins.hooks.fire('filter:error.handle', {
		cases: cases,
	}, (_err, data) => {
		if (_err) {
			// Assume defaults
			winston.warn(`[errors/handle] Unable to retrieve plugin handlers for errors: ${_err.message}`);
			data.cases = cases;
		}

		if (data.cases.hasOwnProperty(err.code)) {
			data.cases[err.code](err, req, res, defaultHandler);
		} else {
			defaultHandler();
		}
	});
};
