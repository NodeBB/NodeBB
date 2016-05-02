
'use strict';

var async = require('async');
var meta = require('../meta');
var categories = require('../categories');
var privileges = require('../privileges');
var user = require('../user');
var topics = require('../topics');
var helpers = require('./helpers');

var unreadController = {};

var validFilter = {'': true, 'new': true, 'watched': true};

unreadController.get = function(req, res, next) {
	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	var results;
	var cid = req.query.cid;
	var filter = req.params.filter || '';

	if (!validFilter[filter]) {
		return next();
	}

	async.waterfall([
		function(next) {
			async.parallel({
				watchedCategories: function(next) {
					user.getWatchedCategories(req.uid, next);
				},
				unreadTopics: function(next) {
					topics.getUnreadTopics(cid, req.uid, 0, stop, filter, next);
				}
			}, next);
		},
		function(_results, next) {
			results = _results;

			privileges.categories.filterCids('read', results.watchedCategories, req.uid, next);
		},
		function(cids, next) {
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'link', 'color', 'bgColor'], next);
		}
	], function(err, categories) {
		if (err) {
			return next(err);
		}

		categories = categories.filter(function(category) {
			return category && !category.link;
		});
		categories.forEach(function(category) {
			category.selected = parseInt(category.cid, 10) === parseInt(cid, 10);
			if (category.selected) {
				results.unreadTopics.selectedCategory = category;
			}
		});
		results.unreadTopics.categories = categories;

		results.unreadTopics.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[unread:title]]'}]);
		results.unreadTopics.title = '[[pages:unread]]';
		results.unreadTopics.filters = [{
			name: '[[unread:all-topics]]',
			url: 'unread',
			selected: filter === ''
		}, {
			name: '[[unread:new-topics]]',
			url: 'unread/new',
			selected: filter === 'new'
		}, {
			name: '[[unread:watched-topics]]',
			url: 'unread/watched',
			selected: filter === 'watched'
		}];

		results.unreadTopics.selectedFilter = results.unreadTopics.filters.filter(function(filter) {
			return filter && filter.selected;
		})[0];

		res.render('unread', results.unreadTopics);
	});
};


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
