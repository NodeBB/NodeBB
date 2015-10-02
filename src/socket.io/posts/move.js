'use strict';

var async = require('async');
var privileges = require('../../privileges');
var topics = require('../../topics');
var socketHelpers = require('../helpers');

module.exports = function(SocketPosts) {

	SocketPosts.movePost = function(socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		if (!data || !data.pid || !data.tid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				privileges.posts.canMove(data.pid, socket.uid, next);
			},
			function (canMove, next) {
				if (!canMove){
					return next(new Error('[[error:no-privileges]]'));
				}

				topics.movePostToTopic(data.pid, data.tid, next);
			},
			function (next) {
				socketHelpers.sendNotificationToPostOwner(data.pid, socket.uid, 'notifications:moved_your_post');
				next();
			}
		], callback);
	};

};