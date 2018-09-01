
'use strict';

var async = require('async');
var nconf = require('nconf');

var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var recentController = module.exports;

recentController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			recentController.getData(req, 'recent', 'recent', next);
		},
		function (data, next) {
			if (!data) {
				return next();
			}
			res.render('recent', data);
		},
	], next);
};

recentController.getData = function (req, url, sort, callback) {
	var page = parseInt(req.query.page, 10) || 1;
	var stop = 0;
	var term = helpers.terms[req.query.term];
	var settings;
	var cid = req.query.cid;
	var filter = req.query.filter || '';
	var categoryData;
	var rssToken;

	if (!helpers.validFilters[filter] || (!term && req.query.term)) {
		return callback(null, null);
	}
	term = term || 'alltime';

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

			topics.getSortedTopics({
				cids: cid,
				uid: req.uid,
				start: start,
				stop: stop,
				filter: filter,
				term: term,
				sort: sort,
			}, next);
		},
		function (data, next) {
			data.categories = categoryData.categories;
			data.allCategoriesUrl = url + helpers.buildQueryString('', filter, '');
			data.selectedCategory = categoryData.selectedCategory;
			data.selectedCids = categoryData.selectedCids;
			data.nextStart = stop + 1;
			data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			data.rssFeedUrl = nconf.get('relative_path') + '/' + url + '.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
			}
			data.title = meta.config.homePageTitle || '[[pages:home]]';

			data.filters = helpers.buildFilters(url, filter, req.query);
			data.selectedFilter = data.filters.find(function (filter) {
				return filter && filter.selected;
			});
			data.terms = helpers.buildTerms(url, term, req.query);
			data.selectedTerm = data.terms.find(function (term) {
				return term && term.selected;
			});

			var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
			data.pagination = pagination.create(page, pageCount, req.query);

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/' + url) || req.originalUrl.startsWith(nconf.get('relative_path') + '/' + url)) {
				data.title = '[[pages:' + url + ']]';
				data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[' + url + ':title]]' }]);
			}

			next(null, data);
		},
	], callback);
};
