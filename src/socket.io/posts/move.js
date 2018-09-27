'use strict';

var async = require('async');
var privileges = require('../../privileges');
var topics = require('../../topics');
var socketHelpers = require('../helpers');

module.exports = function (SocketPosts) {
	SocketPosts.movePost = function (socket, data, callback) {
		SocketPosts.movePosts(socket, { pids: [data.pid], tid: data.tid }, callback);
	};

	SocketPosts.movePosts = function (socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		if (!data || !Array.isArray(data.pids) || !data.tid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.eachSeries(data.pids, function (pid, next) {
			async.waterfall([
				function (next) {
					privileges.posts.canMove(pid, socket.uid, next);
				},
				function (canMove, next) {
					if (!canMove) {
						return next(new Error('[[error:no-privileges]]'));
					}

					topics.movePostToTopic(pid, data.tid, next);
				},
				function (next) {
					socketHelpers.sendNotificationToPostOwner(pid, socket.uid, 'move', 'notifications:moved_your_post');
					next();
				},
			], next);
		}, callback);
	};
};
