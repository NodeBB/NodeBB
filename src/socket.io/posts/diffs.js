'use strict';

var async = require('async');
var posts = require('../../posts');
var privileges = require('../../privileges');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = function (socket, data, callback) {
		async.waterfall([
			async.apply(privilegeCheck, data.pid, socket.uid),
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
		privilegeCheck(data.pid, socket.uid, function (err) {
			if (err) {
				return callback(err);
			}

			posts.diffs.load(data.pid, data.since, socket.uid, callback);
		});
	};

	function privilegeCheck(pid, uid, callback) {
		async.parallel({
			deleted: async.apply(posts.getPostField, pid, 'deleted'),
			privileges: async.apply(privileges.posts.get, [pid], uid),
		}, function (err, payload) {
			if (err) {
				return callback(err);
			}

			payload.privileges = payload.privileges[0];

			const allowed = payload.privileges['posts:history'] && (payload.deleted ? payload.privileges['posts:view_deleted'] : true);
			callback(!allowed ? new Error('[[error:no-privileges]]') : null);
		});
	}
};
