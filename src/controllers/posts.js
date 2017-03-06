'use strict';

var async = require('async');

var posts = require('../posts');
var helpers = require('./helpers');

var postsController = module.exports;

postsController.redirectToPost = function (req, res, next) {
	var pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return next();
	}

	async.waterfall([
		function (next) {
			posts.generatePostPath(pid, req.uid, next);
		},
		function (path, next) {
			if (!path) {
				return next();
			}
			helpers.redirect(res, path);
		},
	], next);
};

postsController.getRecentPosts = function (req, res, next) {
	async.waterfall([
		function (next) {
			posts.getRecentPosts(req.uid, 0, 19, req.params.term, next);
		},
		function (data) {
			res.json(data);
		},
	], next);
};
