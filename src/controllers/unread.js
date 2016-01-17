
'use strict';

var async = require('async'),

	meta = require('../meta'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	user = require('../user'),
	topics = require('../topics'),
	helpers = require('./helpers');

var unreadController = {};

unreadController.get = function(req, res, next) {
	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;
	var results;
	var cid = req.query.cid;

	async.waterfall([
		function(next) {
			async.parallel({
				watchedCategories: function(next) {
					user.getWatchedCategories(req.uid, next);
				},
				unreadTopics: function(next) {
					topics.getUnreadTopics(cid, req.uid, 0, stop, next);
				}
			}, next);
		},
		function(_results, next) {
			results = _results;

			privileges.categories.filterCids('read', results.watchedCategories, req.uid, next);
		},
		function(cids, next) {
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'link', 'color', 'bgColor'], next);
		},
		function(categories, next) {
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
			next(null, results.unreadTopics);
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}

		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[unread:title]]'}]);
		data.title = '[[pages:unread]]';

		res.render('unread', data);
	});
};


unreadController.unreadTotal = function(req, res, next) {
	topics.getTotalUnread(req.uid, function (err, data) {
		if (err) {
			return next(err);
		}

		res.json(data);
	});
};

module.exports = unreadController;