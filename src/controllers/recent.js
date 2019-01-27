
'use strict';

var async = require('async');
var nconf = require('nconf');

var user = require('../user');
var categories = require('../categories');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');
var privileges = require('../privileges');

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
	var canPost;

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
				categories: function (next) {
					helpers.getCategoriesByStates(req.uid, cid, [categories.watchStates.watching, categories.watchStates.notwatching], next);
				},
				rssToken: function (next) {
					user.auth.getFeedToken(req.uid, next);
				},
				canPost: function (next) {
					canPostTopic(req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			rssToken = results.rssToken;
			settings = results.settings;
			categoryData = results.categories;
			canPost = results.canPost;

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
				query: req.query,
			}, next);
		},
		function (data, next) {
			data.canPost = canPost;
			data.categories = categoryData.categories;
			data.allCategoriesUrl = url + helpers.buildQueryString('', filter, '');
			data.selectedCategory = categoryData.selectedCategory;
			data.selectedCids = categoryData.selectedCids;
			data['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
			data.rssFeedUrl = nconf.get('relative_path') + '/' + url + '.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
			}
			data.title = meta.config.homePageTitle || '[[pages:home]]';

			data.filters = helpers.buildFilters(url, filter, req.query);
			data.selectedFilter = data.filters.find(filter => filter && filter.selected);
			data.terms = helpers.buildTerms(url, term, req.query);
			data.selectedTerm = data.terms.find(term => term && term.selected);

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

function canPostTopic(uid, callback) {
	async.waterfall([
		function (next) {
			categories.getAllCidsFromSet('categories:cid', next);
		},
		function (cids, next) {
			privileges.categories.filterCids('topics:create', cids, uid, next);
		},
		function (cids, next) {
			next(null, cids.length > 0);
		},
	], callback);
}
