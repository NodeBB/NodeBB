'use strict';

var nconf = require('nconf');
var async = require('async');
var validator = require('validator');
var winston = require('winston');

var user = require('../user');
var privileges = require('../privileges');
var categories = require('../categories');
var plugins = require('../plugins');
var meta = require('../meta');
var middleware = require('../middleware');

var helpers = module.exports;

helpers.noScriptErrors = function (req, res, error, httpStatus) {
	if (req.body.noscript !== 'true') {
		return res.status(httpStatus).send(error);
	}

	var middleware = require('../middleware');
	var httpStatusString = httpStatus.toString();
	middleware.buildHeader(req, res, function () {
		res.status(httpStatus).render(httpStatusString, {
			path: req.path,
			loggedIn: req.loggedIn,
			error: error,
			returnLink: true,
			title: '[[global:' + httpStatusString + '.title]]',
		});
	});
};

helpers.validFilters = { '': true, new: true, watched: true, unreplied: true };

helpers.buildFilters = function (url, filter) {
	return [{
		name: '[[unread:all-topics]]',
		url: url,
		selected: filter === '',
		filter: '',
	}, {
		name: '[[unread:new-topics]]',
		url: url + '/new',
		selected: filter === 'new',
		filter: 'new',
	}, {
		name: '[[unread:watched-topics]]',
		url: url + '/watched',
		selected: filter === 'watched',
		filter: 'watched',
	}, {
		name: '[[unread:unreplied-topics]]',
		url: url + '/unreplied',
		selected: filter === 'unreplied',
		filter: 'unreplied',
	}];
};

helpers.notAllowed = function (req, res, error) {
	plugins.fireHook('filter:helpers.notAllowed', {
		req: req,
		res: res,
		error: error,
	}, function (err) {
		if (err) {
			return winston.error(err);
		}
		if (req.loggedIn) {
			if (res.locals.isAPI) {
				res.status(403).json({
					path: req.path.replace(/^\/api/, ''),
					loggedIn: req.loggedIn,
					error: error,
					title: '[[global:403.title]]',
				});
			} else {
				middleware.buildHeader(req, res, function () {
					res.status(403).render('403', {
						path: req.path,
						loggedIn: req.loggedIn,
						error: error,
						title: '[[global:403.title]]',
					});
				});
			}
		} else if (res.locals.isAPI) {
			req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = nconf.get('relative_path') + req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	});
};

helpers.redirect = function (res, url) {
	if (res.locals.isAPI) {
		res.set('X-Redirect', encodeURI(url)).status(200).json(url);
	} else {
		res.redirect(nconf.get('relative_path') + encodeURI(url));
	}
};

helpers.buildCategoryBreadcrumbs = function (cid, callback) {
	var breadcrumbs = [];

	async.whilst(function () {
		return parseInt(cid, 10);
	}, function (next) {
		categories.getCategoryFields(cid, ['name', 'slug', 'parentCid', 'disabled', 'isSection'], function (err, data) {
			if (err) {
				return next(err);
			}

			if (!parseInt(data.disabled, 10) && !parseInt(data.isSection, 10)) {
				breadcrumbs.unshift({
					text: validator.escape(String(data.name)),
					url: nconf.get('relative_path') + '/category/' + data.slug,
				});
			}

			cid = data.parentCid;
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		if (meta.config.homePageRoute && meta.config.homePageRoute !== 'categories') {
			breadcrumbs.unshift({
				text: '[[global:header.categories]]',
				url: nconf.get('relative_path') + '/categories',
			});
		}

		breadcrumbs.unshift({
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/',
		});

		callback(null, breadcrumbs);
	});
};

helpers.buildBreadcrumbs = function (crumbs) {
	var breadcrumbs = [
		{
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/',
		},
	];

	crumbs.forEach(function (crumb) {
		if (crumb) {
			if (crumb.url) {
				crumb.url = nconf.get('relative_path') + crumb.url;
			}
			breadcrumbs.push(crumb);
		}
	});

	return breadcrumbs;
};

helpers.buildTitle = function (pageTitle) {
	var titleLayout = meta.config.titleLayout || '{pageTitle} | {browserTitle}';

	var browserTitle = validator.escape(String(meta.config.browserTitle || meta.config.title || 'NodeBB'));
	pageTitle = pageTitle || '';
	var title = titleLayout.replace('{pageTitle}', function () {
		return pageTitle;
	}).replace('{browserTitle}', function () {
		return browserTitle;
	});
	return title;
};

helpers.getWatchedCategories = function (uid, selectedCid, callback) {
	if (selectedCid && !Array.isArray(selectedCid)) {
		selectedCid = [selectedCid];
	}
	async.waterfall([
		function (next) {
			user.getWatchedCategories(uid, next);
		},
		function (cids, next) {
			privileges.categories.filterCids('read', cids, uid, next);
		},
		function (cids, next) {
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'link', 'color', 'bgColor', 'parentCid'], next);
		},
		function (categoryData, next) {
			categoryData = categoryData.filter(function (category) {
				return category && !category.link;
			});
			var selectedCategory = [];
			var selectedCids = [];
			categoryData.forEach(function (category) {
				category.selected = selectedCid ? selectedCid.indexOf(String(category.cid)) !== -1 : false;
				if (category.selected) {
					selectedCategory.push(category);
					selectedCids.push(parseInt(category.cid, 10));
				}
			});
			selectedCids.sort(function (a, b) {
				return a - b;
			});

			if (selectedCategory.length > 1) {
				selectedCategory = {
					icon: 'fa-plus',
					name: '[[unread:multiple-categories-selected]]',
					bgColor: '#ddd',
				};
			} else if (selectedCategory.length === 1) {
				selectedCategory = selectedCategory[0];
			} else {
				selectedCategory = undefined;
			}

			var categoriesData = [];
			var tree = categories.getTree(categoryData, 0);

			tree.forEach(function (category) {
				recursive(category, categoriesData, '');
			});

			next(null, { categories: categoriesData, selectedCategory: selectedCategory, selectedCids: selectedCids });
		},
	], callback);
};

function recursive(category, categoriesData, level) {
	category.level = level;
	categoriesData.push(category);

	category.children.forEach(function (child) {
		recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level);
	});
}
