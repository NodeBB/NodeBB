'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.getPostData = function (pid, callback) {
		async.waterfall([
			function (next) {
				db.getObject('post:' + pid, next);
			},
			function (data, next) {
				plugins.fireHook('filter:post.getPostData', { post: data }, next);
			},
			function (data, next) {
				next(null, data.post);
			},
		], callback);
	};

	Posts.getPostsData = function (pids, callback) {
		async.waterfall([
			function (next) {
				db.getObjects(pids.map(pid => 'post:' + pid), next);
			},
			function (data, next) {
				plugins.fireHook('filter:post.getPostsData', { posts: data }, next);
			},
			function (data, next) {
				next(null, data.posts);
			},
		], callback);
	};

	Posts.getPostField = function (pid, field, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostFields(pid, [field], next);
			},
			function (data, next) {
				next(null, data[field]);
			},
		], callback);
	};

	Posts.getPostFields = function (pid, fields, callback) {
		async.waterfall([
			function (next) {
				db.getObjectFields('post:' + pid, fields, next);
			},
			function (data, next) {
				data.pid = pid;

				plugins.fireHook('filter:post.getFields', { posts: [data], fields: fields }, next);
			},
			function (data, next) {
				next(null, (data && Array.isArray(data.posts) && data.posts.length) ? data.posts[0] : null);
			},
		], callback);
	};

	Posts.getPostsFields = function (pids, fields, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		var keys = pids.map(function (pid) {
			return 'post:' + pid;
		});

		async.waterfall([
			function (next) {
				db.getObjectsFields(keys, fields, next);
			},
			function (posts, next) {
				plugins.fireHook('filter:post.getFields', { posts: posts, fields: fields }, next);
			},
			function (data, next) {
				next(null, (data && Array.isArray(data.posts)) ? data.posts : null);
			},
		], callback);
	};

	Posts.setPostField = function (pid, field, value, callback) {
		async.waterfall([
			function (next) {
				db.setObjectField('post:' + pid, field, value, next);
			},
			function (next) {
				var data = {
					pid: pid,
				};
				data[field] = value;
				plugins.fireHook('action:post.setFields', { data: data });
				next();
			},
		], callback);
	};

	Posts.setPostFields = function (pid, data, callback) {
		async.waterfall([
			function (next) {
				db.setObject('post:' + pid, data, next);
			},
			function (next) {
				data.pid = pid;
				plugins.fireHook('action:post.setFields', { data: data });
				next();
			},
		], callback);
	};
};
