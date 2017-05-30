
'use strict';

var async = require('async');

var meta = require('../meta');
var plugins = require('../plugins');
var search = require('../search');
var categories = require('../categories');
var pagination = require('../pagination');
var helpers = require('./helpers');


var searchController = {};

searchController.search = function (req, res, next) {
	if (!plugins.hasListeners('filter:search.query')) {
		return next();
	}

	if (!req.user && parseInt(meta.config.allowGuestSearching, 10) !== 1) {
		return helpers.notAllowed(req, res);
	}

	var page = Math.max(1, parseInt(req.query.page, 10)) || 1;
	if (req.query.categories && !Array.isArray(req.query.categories)) {
		req.query.categories = [req.query.categories];
	}

	var data = {
		query: req.query.term,
		searchIn: req.query.in || 'posts',
		postedBy: req.query.by,
		categories: req.query.categories,
		searchChildren: req.query.searchChildren,
		hasTags: req.query.hasTags,
		replies: req.query.replies,
		repliesFilter: req.query.repliesFilter,
		timeRange: req.query.timeRange,
		timeFilter: req.query.timeFilter,
		sortBy: req.query.sortBy || meta.config.searchDefaultSortBy || '',
		sortDirection: req.query.sortDirection,
		page: page,
		uid: req.uid,
		qs: req.query,
	};

	async.parallel({
		categories: async.apply(categories.buildForSelect, req.uid, 'read'),
		search: async.apply(search.search, data),
	}, function (err, results) {
		if (err) {
			return next(err);
		}

		var categoriesData = [
			{ value: 'all', text: '[[unread:all_categories]]' },
			{ value: 'watched', text: '[[category:watched-categories]]' },
		].concat(results.categories);

		var searchData = results.search;
		searchData.categories = categoriesData;
		searchData.categoriesCount = Math.max(10, Math.min(20, categoriesData.length));
		searchData.pagination = pagination.create(page, searchData.pageCount, req.query);
		searchData.showAsPosts = !req.query.showAs || req.query.showAs === 'posts';
		searchData.showAsTopics = req.query.showAs === 'topics';
		searchData.title = '[[global:header.search]]';
		searchData.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[global:search]]' }]);
		searchData.expandSearch = !req.query.term;
		searchData.searchDefaultSortBy = meta.config.searchDefaultSortBy || '';

		res.render('search', searchData);
	});
};

module.exports = searchController;
