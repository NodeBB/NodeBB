
'use strict';

var searchController = {},
	validator = require('validator'),
	plugins = require('../plugins'),
	search = require('../search'),
	helpers = require('./helpers');


searchController.search = function(req, res, next) {
	if (!plugins.hasListeners('filter:search.query')) {
		return helpers.notFound(req, res);
	}
	var breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:search]]'}]);
	if (!req.params.term) {
		return res.render('search', {
			time: 0,
			search_query: '',
			posts: [],
			topics: [],
			users: [],
			tags: [],
			breadcrumbs: breadcrumbs
		});
	}

	var uid = req.user ? req.user.uid : 0;

	req.params.term = validator.escape(req.params.term);

	search.search({
		query: req.params.term,
		searchIn: req.query.in,
		postedBy: req.query.by,
		uid: uid
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		results.breadcrumbs = breadcrumbs;
		res.render('search', results);
	});
};


module.exports = searchController;
