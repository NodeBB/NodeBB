'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');
var utils = require('../utils');

const intFields = [
	'uid', 'pid', 'tid', 'deleted', 'timestamp',
	'upvotes', 'downvotes', 'deleterUid', 'edited',
];

module.exports = function (Posts) {
	Posts.getPostsFields = function (pids, fields, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		async.waterfall([
			function (next) {
				const keys = pids.map(pid => 'post:' + pid);
				if (fields.length) {
					db.getObjectsFields(keys, fields, next);
				} else {
					db.getObjects(keys, next);
				}
			},
			function (posts, next) {
				plugins.fireHook('filter:post.getFields', { posts: posts, fields: fields }, next);
			},
			function (data, next) {
				data.posts.forEach(post => modifyPost(post, fields));
				next(null, Array.isArray(data.posts) ? data.posts : null);
			},
		], callback);
	};

	Posts.getPostData = function (pid, callback) {
		Posts.getPostsFields([pid], [], function (err, posts) {
			callback(err, posts && posts.length ? posts[0] : null);
		});
	};

	Posts.getPostsData = function (pids, callback) {
		Posts.getPostsFields(pids, [], callback);
	};

	Posts.getPostField = function (pid, field, callback) {
		Posts.getPostFields(pid, [field], function (err, post) {
			callback(err, post ? post[field] : null);
		});
	};

	Posts.getPostFields = function (pid, fields, callback) {
		Posts.getPostsFields([pid], fields, function (err, posts) {
			callback(err, posts ? posts[0] : null);
		});
	};

	Posts.setPostField = function (pid, field, value, callback) {
		Posts.setPostFields(pid, { [field]: value }, callback);
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

function modifyPost(post, fields) {
	if (post) {
		db.parseIntFields(post, intFields, fields);
		if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
			post.votes = post.upvotes - post.downvotes;
		}
		if (post.hasOwnProperty('timestamp')) {
			post.timestampISO = utils.toISOString(post.timestamp);
		}
		if (post.hasOwnProperty('edited')) {
			post.editedISO = post.edited !== 0 ? utils.toISOString(post.edited) : '';
		}
	}
}
