
'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var recentController = {};

recentController.get = function(req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var pageCount = 1;
	var stop = 0;
	var topicCount = 0;
	var settings;

	async.waterfall([
		function (next) {
			async.parallel({
				settings: function(next) {
					user.getSettings(req.uid, next);
				},
				tids: function (next) {
					db.getSortedSetRevRange('topics:recent', 0, 199, next);
				}
			}, next);
		},
		function (results, next) {
			settings = results.settings;
			privileges.topics.filterTids('read', results.tids, req.uid, next);
		},
		function (tids, next) {
			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			stop = start + settings.topicsPerPage - 1;

			topicCount = tids.length;
			pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));
			tids = tids.slice(start, stop + 1);

			topics.getTopicsByTids(tids, req.uid, next);
		}
	], function(err, topics) {
		if (err) {
			return next(err);
		}

		var data = {};
		data.topics = topics;
		data.nextStart = stop + 1;
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.title = '[[pages:recent]]';
		data.pagination = pagination.create(page, pageCount);
		if (req.path.startsWith('/api/recent') || req.path.startsWith('/recent')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
		}

		res.render('recent', data);
	});
};

module.exports = recentController;