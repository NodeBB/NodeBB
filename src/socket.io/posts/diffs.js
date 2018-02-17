'use strict';

var posts = require('../../posts');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = function (socket, data, callback) {
		posts.diffs.list(data.pid, callback);
	};

	SocketPosts.showPostAt = function (socket, data, callback) {
		posts.diffs.load(data.pid, data.since, socket.uid, callback);
	};
};
