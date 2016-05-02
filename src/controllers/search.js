
'use strict';

var async = require('async');

var meta = require('../meta');
var plugins = require('../plugins');
var search = require('../search');
var categories = require('../categories');
var pagination = require('../pagination');
var helpers = require('./helpers');


var searchController = {};

searchController.search = function(req, res, next) {
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
		query: req.params.term,
		searchIn: req.query.in || 'posts',
		postedBy: req.query.by,
		categories: req.query.categories,
		searchChildren: req.query.searchChildren,
		replies: req.query.replies,
		repliesFilter: req.query.repliesFilter,
		timeRange: req.query.timeRange,
		timeFilter: req.query.timeFilter,
		sortBy: req.query.sortBy,
		sortDirection: req.query.sortDirection,
		page: page,
		uid: req.uid,
		qs: req.query
	};

	async.parallel({
		categories: async.apply(buildCategories, req.uid),
		search: async.apply(search.search, data)
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		var searchData = results.search;
		searchData.categories = results.categories;
		searchData.categoriesCount = results.categories.length;
		searchData.pagination = pagination.create(page, searchData.pageCount, req.query);
		searchData.showAsPosts = !req.query.showAs || req.query.showAs === 'posts';
		searchData.showAsTopics = req.query.showAs === 'topics';
		searchData.title = '[[global:header.search]]';
		searchData.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:search]]'}]);
		searchData.expandSearch = !req.params.term;

		res.render('search', searchData);
	});
};

function buildCategories(uid, callback) {
	categories.getCategoriesByPrivilege('cid:0:children', uid, 'read', function(err, categories) {
		if (err) {
			return callback(err);
		}

		var categoriesData = [
			{value: 'all', text: '[[unread:all_categories]]'},
			{value: 'watched', text: '[[category:watched-categories]]'}
		];

		categories = categories.filter(function(category) {
			return category && !category.link && !parseInt(category.parentCid, 10);
		});

		categories.forEach(function(category) {
			recursive(category, categoriesData, '');
		});
		callback(null, categoriesData);
	});
}


function recursive(category, categoriesData, level) {
	if (category.link) {
		return;
	}

	var bullet = level ? '&bull; ' : '';

	categoriesData.push({
		value: category.cid,
		text: level + bullet + category.name
	});

	category.children.forEach(function(child) {
		recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level);
	});
}

module.exports = searchController;
