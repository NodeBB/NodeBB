"use strict";

var async = require('async'),

	posts = require('../posts'),
	privileges = require('../privileges'),
	helpers = require('./helpers'),
	postsController = {};

postsController.getPost = function(req, res, next) {
	async.parallel({
		canRead: function(next) {
			privileges.posts.can('read', req.params.pid, req.uid, next);
		},
		postData: function(next) {
			posts.getPostData(req.params.pid, next);
		}
	}, function(err, results) {
		if (err || !results.postData) {
			return next(err);
		}

		if (!results.canRead) {
			return helpers.notAllowed(req, res);
		}

		res.json(results.postData);
	});
};



module.exports = postsController;
