'use strict';

var nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

	translator = require('../../public/src/modules/translator'),
	categories = require('../categories'),
	plugins = require('../plugins'),
	meta = require('../meta');

var helpers = {};

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
		res.status(308).json(url);
	} else {
		res.redirect(nconf.get('relative_path') + encodeURI(url));
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

		if (!meta.config.homePageRoute && meta.config.homePageCustom) {
			breadcrumbs.unshift({
				text: '[[global:header.categories]]',
				url: nconf.get('relative_path') + '/categories'
			});
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

helpers.buildTitle = function(pageTitle) {
	var titleLayout = meta.config.titleLayout || '{pageTitle} | {browserTitle}';

	var browserTitle = validator.escape(meta.config.browserTitle || meta.config.title || 'NodeBB');
	pageTitle = pageTitle || '';
	var title = titleLayout.replace('{pageTitle}', function() {
		return pageTitle;
	}).replace('{browserTitle}', function() {
		return browserTitle;
	});
	return title;
};

module.exports = helpers;
