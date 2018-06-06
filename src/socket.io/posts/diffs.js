'use strict';

var async = require('async');
var posts = require('../../posts');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = function (socket, data, callback) {
		async.waterfall([
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
		posts.diffs.load(data.pid, data.since, socket.uid, callback);
	};
};
