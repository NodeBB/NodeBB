
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

	var uid = req.user ? req.user.uid : 0;
	var breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:search]]'}]);

	categories.getCategoriesByPrivilege(uid, 'read', function(err, categories) {
		if (err) {
			return next(err);
		}

		if (!req.params.term) {
			return res.render('search', {
				time: 0,
				search_query: '',
				posts: [],
				topics: [],
				users: [],
				tags: [],
				categories: categories,
				breadcrumbs: breadcrumbs
			});
		}

		req.params.term = validator.escape(req.params.term);
		var page = Math.max(1, parseInt(req.query.page, 10)) || 1;

		search.search({
			query: req.params.term,
			searchIn: req.query.in,
			postedBy: req.query.by,
			categories: req.query.categories,
			searchChildren: req.query.searchChildren,
			replies: req.query.replies,
			repliesFilter: req.query.repliesFilter,
			timeRange: req.query.timeRange,
			timeFilter: req.query.timeFilter,
			page: page,
			uid: uid
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			var pageCount = Math.max(1, Math.ceil(results.matchCount / 10));
			results.pagination = pagination.create(page, pageCount, req.query);

			results.breadcrumbs = breadcrumbs;
			results.categories = categories;
			res.render('search', results);
		});
	});
};


module.exports = searchController;
