'use strict';

var async = require('async');

var posts = require('../posts');
var privileges = require('../privileges');
var helpers = require('./helpers');

var postsController = module.exports;

postsController.redirectToPost = function (req, res, next) {
	var pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return next();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				canRead: function (next) {
					privileges.posts.can('read', pid, req.uid, next);
				},
				path: function (next) {
					posts.generatePostPath(pid, req.uid, next);
				},
			}, next);
		},
		function (results, next) {
			if (!results.path) {
				return next();
			}
			if (!results.canRead) {
				return helpers.notAllowed(req, res);
			}
			helpers.redirect(res, results.path);
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
