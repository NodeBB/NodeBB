'use strict';

var nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

	translator = require('../../public/src/modules/translator'),
	categories = require('../categories'),
	plugins = require('../plugins'),
	meta = require('../meta');

var helpers = {};

helpers.notFound = function(req, res, error) {
	if (plugins.hasListeners('action:meta.override404')) {
		plugins.fireHook('action:meta.override404', {
			req: req,
			res: res,
			error: error
		});
	} else if (res.locals.isAPI) {
		res.status(404).json({
			path: req.path.replace(/^\/api/, ''),
			error: error,
			title: '[[global:404.title]]'
		});
	} else {
		res.status(404).render('404', {
			path: req.path,
			error: error,
			title: '[[global:404.title]]'
		});
	}
};

helpers.notAllowed = function(req, res, error) {
	if (req.uid) {
		if (res.locals.isAPI) {
			res.status(403).json({
				path: req.path.replace(/^\/api/, ''),
				loggedIn: !!req.uid, error: error,
				title: '[[global:403.title]]'
			});
		} else {
			res.status(403).render('403', {
				path: req.path,
				loggedIn: !!req.uid, error: error,
				title: '[[global:403.title]]'
			});
		}
	} else {
		if (res.locals.isAPI) {
			req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = nconf.get('relative_path') + req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	}
};

helpers.redirect = function(res, url) {
	if (res.locals.isAPI) {
		res.status(302).json(url);
	} else {
		res.redirect(nconf.get('relative_path') + url);
	}
};

helpers.buildCategoryBreadcrumbs = function(cid, callback) {
	var breadcrumbs = [];

	async.whilst(function() {
		return parseInt(cid, 10);
	}, function(next) {
		categories.getCategoryFields(cid, ['name', 'slug', 'parentCid', 'disabled'], function(err, data) {
			if (err) {
				return next(err);
			}

			if (!parseInt(data.disabled, 10)) {
				breadcrumbs.unshift({
					text: validator.escape(data.name),
					url: nconf.get('relative_path') + '/category/' + data.slug
				});
			}

			cid = data.parentCid;
			next();
		});
	}, function(err) {
		if (err) {
			return callback(err);
		}

		breadcrumbs.unshift({
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/'
		});

		callback(null, breadcrumbs);
	});
};

helpers.buildBreadcrumbs = function(crumbs) {
	var breadcrumbs = [
		{
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/'
		}
	];

	crumbs.forEach(function(crumb) {
		if (crumb) {
			if (crumb.url) {
				crumb.url = nconf.get('relative_path') + crumb.url;
			}
			breadcrumbs.push(crumb);
		}
	});

	return breadcrumbs;
};

module.exports = helpers;