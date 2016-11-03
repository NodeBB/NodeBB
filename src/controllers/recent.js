
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var recentController = {};

var validFilter = {'': true, 'new': true, 'watched': true};

recentController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var pageCount = 1;
	var stop = 0;
	var topicCount = 0;
	var settings;
	var cid = req.query.cid;
	var filter = req.params.filter || '';
	var categoryData;

	if (!validFilter[filter]) {
		return next();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				settings: function (next) {
					user.getSettings(req.uid, next);
				},
				tids: function (next) {
					db.getSortedSetRevRange(cid ? 'cid:' + cid + ':tids' : 'topics:recent', 0, 199, next);
				},
				watchedCategories: function (next) {
					helpers.getWatchedCategories(req.uid, cid, next);
				}
			}, next);
		},
		function (results, next) {
			settings = results.settings;
			categoryData = results.watchedCategories;
			filterTids(results.tids, req.uid, categoryData.categories, filter, next);
		},
		function (tids, next) {
			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			stop = start + settings.topicsPerPage - 1;

			topicCount = tids.length;
			pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));
			tids = tids.slice(start, stop + 1);

			topics.getTopicsByTids(tids, req.uid, next);
		}
	], function (err, topics) {
		if (err) {
			return next(err);
		}

		var data = {};
		data.topics = topics;
		data.categories = categoryData.categories;
		data.selectedCategory = categoryData.selectedCategory;
		data.nextStart = stop + 1;
		data.set = 'topics:recent';
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.title = '[[pages:recent]]';
		data.filters = [{
			name: '[[unread:all-topics]]',
			url: 'recent',
			selected: filter === '',
			filter: ''
		}, {
			name: '[[unread:new-topics]]',
			url: 'recent/new',
			selected: filter === 'new',
			filter: 'new'
		}, {
			name: '[[unread:watched-topics]]',
			url: 'recent/watched',
			selected: filter === 'watched',
			filter: 'watched'
		}];

		data.selectedFilter = data.filters.find(function (filter) {
			return filter && filter.selected;
		});

		data.pagination = pagination.create(page, pageCount, req.query);
		if (req.path.startsWith('/api/recent') || req.path.startsWith('/recent')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
		}
		data.querystring = cid ? ('?cid=' + validator.escape(String(cid))) : '';
		res.render('recent', data);
	});
};

function filterTids(tids, uid, watchedCategories, filter, callback) {
	async.waterfall([
		function (next) {
			if (filter === 'watched') {
				topics.filterWatchedTids(tids, uid, next);
			} else if (filter === 'new') {
				topics.filterNewTids(tids, uid, next);
			} else {
				topics.filterNotIgnoredTids(tids, uid, next);
			}
		},
		function (tids, next) {
			privileges.topics.filterTids('read', tids, uid, next);
		},
		function (tids, next) {
			topics.getTopicsFields(tids, ['tid', 'cid'], next);
		},
		function (topicData, next) {
			var watchedCids = watchedCategories.map(function (category) {
				return category && parseInt(category.cid, 10);
			});

			tids = topicData.filter(function (topic, index) {
				if (topic) {
					var topicCid = parseInt(topic.cid, 10);
					return watchedCids.indexOf(topicCid) !== -1;
				} else {
					return false;
				}
			}).map(function (topic) {
				return topic.tid;
			});
			next(null, tids);
		}
	], callback);
}

module.exports = recentController;