'use strict';


var async = require('async');
var posts = require('../../posts');
var plugins = require('../../plugins');
var websockets = require('../index');
var socketHelpers = require('../helpers');

var helpers = module.exports;

helpers.postCommand = function(socket, command, eventName, notification, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}
	if (!data || !data.pid || !data.room_id) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.parallel({
		exists: function(next) {
			posts.exists(data.pid, next);
		},
		deleted: function(next) {
			posts.getPostField(data.pid, 'deleted', next);
		}
	}, function(err, results) {
		if (err || !results.exists) {
			return callback(err || new Error('[[error:invalid-pid]]'));
		}

		if (parseInt(results.deleted, 10) === 1) {
			return callback(new Error('[[error:post-deleted]]'));
		}

		/*
		hooks:
			filter:post.upvote
			filter:post.downvote
			filter:post.unvote
			filter:post.bookmark
			filter:post.unbookmark
		 */
		plugins.fireHook('filter:post.' + command, {data: data, uid: socket.uid}, function(err, filteredData) {
			if (err) {
				return callback(err);
			}

			executeCommand(socket, command, eventName, notification, filteredData.data, callback);
		});
	});
};

function executeCommand(socket, command, eventName, notification, data, callback) {
	posts[command](data.pid, socket.uid, function(err, result) {
		if (err) {
			return callback(err);
		}

		if (result && eventName) {
			socket.emit('posts.' + command, result);
			websockets.in(data.room_id).emit('event:' + eventName, result);
		}

		if (result && notification) {
			socketHelpers.sendNotificationToPostOwner(data.pid, socket.uid, command, notification);
		} else if (result && command === 'unvote') {
			socketHelpers.rescindUpvoteNotification(data.pid, socket.uid);
		}
		callback();
	});
}