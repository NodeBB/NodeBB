
'use strict';

var async = require('async');
var querystring = require('querystring');
var validator = require('validator');

var categories = require('../categories');
var privileges = require('../privileges');
var pagination = require('../pagination');
var user = require('../user');
var topics = require('../topics');
var helpers = require('./helpers');

var unreadController = {};

var validFilter = {'': true, 'new': true, 'watched': true};

unreadController.get = function(req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var results;
	var cid = req.query.cid;
	var filter = req.params.filter || '';

	if (!validFilter[filter]) {
		return next();
	}
	var settings;
	async.waterfall([
		function(next) {
			async.parallel({
				watchedCategories: function(next) {
					getWatchedCategories(req.uid, cid, next);
				},
				settings: function(next) {
					user.getSettings(req.uid, next);
				}
			}, next);
		},
		function(_results, next) {
			results = _results;
			settings = results.settings;
			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			var stop = start + settings.topicsPerPage - 1;
			topics.getUnreadTopics(cid, req.uid, start, stop, filter, next);
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}

		data.pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
		data.pagination = pagination.create(page, data.pageCount, req.query);

		if (settings.usePagination && (page < 1 || page > data.pageCount)) {
			req.query.page = Math.max(1, Math.min(data.pageCount, page));
			return helpers.redirect(res, '/unread?' + querystring.stringify(req.query));
		}

		data.categories = results.watchedCategories.categories;
		data.selectedCategory = results.watchedCategories.selectedCategory;

		if (req.path.startsWith('/api/unread') || req.path.startsWith('/unread')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[unread:title]]'}]);
		}

		data.title = '[[pages:unread]]';
		data.filters = [{
			name: '[[unread:all-topics]]',
			url: 'unread',
			selected: filter === '',
			filter: ''
		}, {
			name: '[[unread:new-topics]]',
			url: 'unread/new',
			selected: filter === 'new',
			filter: 'new'
		}, {
			name: '[[unread:watched-topics]]',
			url: 'unread/watched',
			selected: filter === 'watched',
			filter: 'watched'
		}];

		data.selectedFilter = data.filters.filter(function(filter) {
			return filter && filter.selected;
		})[0];

		data.querystring = cid ? ('?cid=' + validator.escape(String(cid))) : '';

		res.render('unread', data);
	});
};

function getWatchedCategories(uid, selectedCid, callback) {
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
			categoryData = categoryData.filter(function(category) {
				return category && !category.link;
			});

			var selectedCategory;
			categoryData.forEach(function(category) {
				category.selected = parseInt(category.cid, 10) === parseInt(selectedCid, 10);
				if (category.selected) {
					selectedCategory = category;
				}
			});

			var categoriesData = [];
			var tree = categories.getTree(categoryData, 0);

			tree.forEach(function(category) {
				recursive(category, categoriesData, '');
			});

			next(null, {categories: categoriesData, selectedCategory: selectedCategory});
		}
	], callback);
}

function recursive(category, categoriesData, level) {
	category.level = level;
	categoriesData.push(category);

	category.children.forEach(function(child) {
		recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level);
	});
}

unreadController.unreadTotal = function(req, res, next) {
	var filter = req.params.filter || '';

	if (!validFilter[filter]) {
		return next();
	}

	topics.getTotalUnread(req.uid, filter, function (err, data) {
		if (err) {
			return next(err);
		}

		res.json(data);
	});
};

module.exports = unreadController;
