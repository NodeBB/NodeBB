
'use strict';

var searchController = {},
	validator = require('validator'),
	plugins = require('../plugins'),
	search = require('../search'),
	categories = require('../categories'),
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

			results.breadcrumbs = breadcrumbs;
			results.categories = categories;
			res.render('search', results);
		});
	});
};


module.exports = searchController;
