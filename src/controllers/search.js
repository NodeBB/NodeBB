
'use strict';

var async = require('async'),
	validator = require('validator'),
	plugins = require('../plugins'),
	search = require('../search'),
	categories = require('../categories'),
	pagination = require('../pagination'),
	helpers = require('./helpers');


var searchController = {};

searchController.search = function(req, res, next) {
	if (!plugins.hasListeners('filter:search.query')) {
		return next();
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
		uid: req.uid
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

		plugins.fireHook('filter:search.build', {data: data, results: searchData}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('search', data.results);
		});
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
