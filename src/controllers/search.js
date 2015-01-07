
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

	if (!req.params.term) {
		return res.render('search', {
			time: 0,
			search_query: '',
			posts: [],
			topics: [],
			users: [],
			tags: []
		});
	}

	var uid = req.user ? req.user.uid : 0;

	req.params.term = validator.escape(req.params.term);

	search.search(req.params.term, req.query.in, uid, function(err, results) {
		if (err) {
			return next(err);
		}

		res.render('search', results);
	});
};


module.exports = searchController;
