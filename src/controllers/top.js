
'use strict';

var async = require('async');
var nconf = require('nconf');
var querystring = require('querystring');

var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var topController = module.exports;

topController.get = function (req, res, next) {
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

			topics.getTopTopics(cid, req.uid, start, stop, filter, next);
		},
		function (data) {
			data.categories = categoryData.categories;
			data.selectedCategory = categoryData.selectedCategory;
			data.selectedCids = categoryData.selectedCids;
			data.nextStart = stop + 1;
			data.set = 'topics:votes';
			data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			data.rssFeedUrl = nconf.get('relative_path') + '/top.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
			}
			data.title = meta.config.homePageTitle || '[[pages:home]]';
			data.filters = helpers.buildFilters('top', filter);

			data.selectedFilter = data.filters.find(function (filter) {
				return filter && filter.selected;
			});

			var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
			data.pagination = pagination.create(page, pageCount, req.query);

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/top') || req.originalUrl.startsWith(nconf.get('relative_path') + '/top')) {
				data.title = '[[pages:top]]';
				data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[top:title]]' }]);
			}

			data.querystring = cid ? '?' + querystring.stringify({ cid: cid }) : '';

			res.render('top', data);
		},
	], next);
};
