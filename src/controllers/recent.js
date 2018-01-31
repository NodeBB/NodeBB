
'use strict';

var async = require('async');
var nconf = require('nconf');
var querystring = require('querystring');

var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var recentController = module.exports;

recentController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var stop = 0;
	var settings;
	var cid = req.query.cid;
	var filter = req.params.filter || '';
	var categoryData;
	var rssToken;

	if (!helpers.validFilters[filter]) {
		return next();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				settings: function (next) {
					user.getSettings(req.uid, next);
				},
				watchedCategories: function (next) {
					helpers.getWatchedCategories(req.uid, cid, next);
				},
				rssToken: function (next) {
					user.auth.getFeedToken(req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			rssToken = results.rssToken;
			settings = results.settings;
			categoryData = results.watchedCategories;

			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			stop = start + settings.topicsPerPage - 1;

			topics.getRecentTopics(cid, req.uid, start, stop, filter, next);
		},
		function (data) {
			data.categories = categoryData.categories;
			data.selectedCategory = categoryData.selectedCategory;
			data.selectedCids = categoryData.selectedCids;
			data.nextStart = stop + 1;
			data.set = 'topics:recent';
			data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
			}
			data.title = meta.config.homePageTitle || '[[pages:home]]';
			data.filters = helpers.buildFilters('recent', filter);

			data.selectedFilter = data.filters.find(function (filter) {
				return filter && filter.selected;
			});

			var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
			data.pagination = pagination.create(page, pageCount, req.query);

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/recent') || req.originalUrl.startsWith(nconf.get('relative_path') + '/recent')) {
				data.title = '[[pages:recent]]';
				data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[recent:title]]' }]);
			}

			data.querystring = cid ? '?' + querystring.stringify({ cid: cid }) : '';

			res.render('recent', data);
		},
	], next);
};
