'use strict';

var async = require('async');
var posts = require('../../posts');
var privileges = require('../../privileges');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = function (socket, data, callback) {
		async.waterfall([
			function (next) {
				privileges.posts.can('posts:history', data.pid, socket.uid, function (err, allowed) {
					next(err || allowed ? null : new Error('[[error:no-privileges]]'));
				});
			},
			function (next) {
				posts.diffs.list(data.pid, next);
			},
			function (timestamps, next) {
				timestamps.unshift(Date.now());
				next(null, timestamps);
			},
		], callback);
	};

	SocketPosts.showPostAt = function (socket, data, callback) {
		privileges.posts.can('posts:history', data.pid, socket.uid, function (err, allowed) {
			if (err || !allowed) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}

			posts.diffs.load(data.pid, data.since, socket.uid, callback);
		});
	};
};
