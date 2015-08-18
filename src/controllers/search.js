
'use strict';

var searchController = {},
	validator = require('validator'),
	plugins = require('../plugins'),
	search = require('../search'),
	categories = require('../categories'),
	pagination = require('../pagination'),
	helpers = require('./helpers');


searchController.search = function(req, res, next) {
	if (!plugins.hasListeners('filter:search.query')) {
		return helpers.notFound(req, res);
	}

	var breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:search]]'}]);

	categories.getCategoriesByPrivilege('categories:cid', req.uid, 'read', function(err, categories) {
		if (err) {
			return next(err);
		}

		categories = categories.filter(function(category) {
			return category && !category.link;
		});

		req.params.term = validator.escape(req.params.term);
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

		search.search(data, function(err, results) {
			if (err) {
				return next(err);
			}

			results.pagination = pagination.create(page, results.pageCount, req.query);
			results.showAsPosts = !req.query.showAs || req.query.showAs === 'posts';
			results.showAsTopics = req.query.showAs === 'topics';
			results.breadcrumbs = breadcrumbs;
			results.categories = categories;
			results.expandSearch = !req.params.term;

			plugins.fireHook('filter:search.build', {data: data, results: results}, function(err, data) {
				if (err) {
					return next(err);
				}
				res.render('search', data.results);
			});
		});
	});
};


module.exports = searchController;
