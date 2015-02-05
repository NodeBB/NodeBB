
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

		search.search({
			query: req.params.term,
			searchIn: req.query.in,
			postedBy: req.query.by,
			categories: req.query.categories,
			searchChildren: req.query.searchChildren,
			replies: req.query.replies,
			repliesFilter: req.query.repliesFilter,
			uid: uid
		}, function(err, results) {
			if (err) {
				return next(err);
			}
			var currentPage = Math.max(1, parseInt(req.query.page, 10)) || 1;
			var pageCount = Math.max(1, Math.ceil(results.matchCount / 10));
			var searchIn = req.query.in || 'posts';
			var start = Math.max(0, (currentPage - 1)) * 10;
			results[searchIn] = results[searchIn].slice(start, start + 10);

			pagination.create(currentPage, pageCount, results, req.query);

			results.breadcrumbs = breadcrumbs;
			results.categories = categories;
			res.render('search', results);
		});
	});
};


module.exports = searchController;
