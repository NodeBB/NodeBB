'use strict';

var nconf = require('nconf');
var async = require('async');
var validator = require('validator');
var winston = require('winston');
var querystring = require('querystring');

var user = require('../user');
var privileges = require('../privileges');
var categories = require('../categories');
var plugins = require('../plugins');
var meta = require('../meta');
var middleware = require('../middleware');
var utils = require('../utils');

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

helpers.terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
};

helpers.buildQueryString = function (cid, filter, term) {
	var qs = {};
	if (cid) {
		qs.cid = cid;
	}
	if (filter) {
		qs.filter = filter;
	}
	if (term) {
		qs.term = term;
	}

	if (Object.keys(qs).length) {
		return '?' + querystring.stringify(qs);
	}
	return '';
};

helpers.buildFilters = function (url, filter, query) {
	return [{
		name: '[[unread:all-topics]]',
		url: url + helpers.buildQueryString(query.cid, '', query.term),
		selected: filter === '',
		filter: '',
	}, {
		name: '[[unread:new-topics]]',
		url: url + helpers.buildQueryString(query.cid, 'new', query.term),
		selected: filter === 'new',
		filter: 'new',
	}, {
		name: '[[unread:watched-topics]]',
		url: url + helpers.buildQueryString(query.cid, 'watched', query.term),
		selected: filter === 'watched',
		filter: 'watched',
	}, {
		name: '[[unread:unreplied-topics]]',
		url: url + helpers.buildQueryString(query.cid, 'unreplied', query.term),
		selected: filter === 'unreplied',
		filter: 'unreplied',
	}];
};

helpers.buildTerms = function (url, term, query) {
	return [{
		name: '[[recent:alltime]]',
		url: url + helpers.buildQueryString(query.cid, query.filter, ''),
		selected: term === 'alltime',
		term: 'alltime',
	}, {
		name: '[[recent:day]]',
		url: url + helpers.buildQueryString(query.cid, query.filter, 'daily'),
		selected: term === 'day',
		term: 'day',
	}, {
		name: '[[recent:week]]',
		url: url + helpers.buildQueryString(query.cid, query.filter, 'weekly'),
		selected: term === 'week',
		term: 'week',
	}, {
		name: '[[recent:month]]',
		url: url + helpers.buildQueryString(query.cid, query.filter, 'monthly'),
		selected: term === 'month',
		term: 'month',
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
			req.session.returnTo = req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = req.url;
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

			if (!data.disabled && !data.isSection) {
				breadcrumbs.unshift({
					text: String(data.name),
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

helpers.getCategories = function (set, uid, privilege, selectedCid, callback) {
	async.waterfall([
		function (next) {
			categories.getCidsByPrivilege(set, uid, privilege, next);
		},
		function (cids, next) {
			getCategoryData(cids, uid, selectedCid, next);
		},
	], callback);
};

helpers.getCategoriesByStates = function (uid, selectedCid, states, callback) {
	async.waterfall([
		function (next) {
			user.getCategoriesByStates(uid, states, next);
		},
		function (cids, next) {
			privileges.categories.filterCids('read', cids, uid, next);
		},
		function (cids, next) {
			getCategoryData(cids, uid, selectedCid, next);
		},
	], callback);
};

helpers.getWatchedCategories = function (uid, selectedCid, callback) {
	async.waterfall([
		function (next) {
			user.getWatchedCategories(uid, next);
		},
		function (cids, next) {
			privileges.categories.filterCids('read', cids, uid, next);
		},
		function (cids, next) {
			getCategoryData(cids, uid, selectedCid, next);
		},
	], callback);
};

function getCategoryData(cids, uid, selectedCid, callback) {
	if (selectedCid && !Array.isArray(selectedCid)) {
		selectedCid = [selectedCid];
	}
	async.waterfall([
		function (next) {
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'link', 'color', 'bgColor', 'parentCid', 'image', 'imageClass'], next);
		},
		function (categoryData, next) {
			categoryData = categoryData.filter(category => category && !category.link);
			var selectedCategory = [];
			var selectedCids = [];
			categoryData.forEach(function (category) {
				category.selected = selectedCid ? selectedCid.includes(String(category.cid)) : false;
				category.parentCid = category.hasOwnProperty('parentCid') && utils.isNumber(category.parentCid) ? category.parentCid : 0;
				if (category.selected) {
					selectedCategory.push(category);
					selectedCids.push(category.cid);
				}
			});
			selectedCids.sort((a, b) => a - b);

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
			var tree = categories.getTree(categoryData);

			tree.forEach(function (category) {
				recursive(category, categoriesData, '');
			});

			next(null, { categories: categoriesData, selectedCategory: selectedCategory, selectedCids: selectedCids });
		},
	], callback);
}

function recursive(category, categoriesData, level) {
	category.level = level;
	categoriesData.push(category);
	if (Array.isArray(category.children)) {
		category.children.forEach(function (child) {
			recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level);
		});
	}
}
