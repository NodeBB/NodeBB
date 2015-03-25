"use strict";

var async = require('async'),
	
	posts = require('../posts'),
	privileges = require('../privileges'),
	helpers = require('./helpers'),
	postsController = {};

postsController.getPost = function(req, res, next) {
	var uid = req.user ? parseInt(req.user.uid) : 0;
	async.parallel({
		canRead: function(next) {
			privileges.posts.can('read', req.params.pid, uid, next);
		},
		postData: function(next) {
			posts.getPostData(req.params.pid, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		if (!results.postData) {
			return helpers.notFound(req, res);
		}
		if (!results.canRead) {
			return helpers.notAllowed(req, res);
		}

		res.json(results.postData);
	});
};



module.exports = postsController;
