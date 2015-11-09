"use strict";

var	async = require('async'),

	posts = require('../posts'),
	privileges = require('../privileges'),
	meta = require('../meta'),
	topics = require('../topics'),
	user = require('../user'),
	websockets = require('./index'),
	socketTopics = require('./topics'),
	socketHelpers = require('./helpers'),
	utils = require('../../public/src/utils'),

	SocketPosts = {};


require('./posts/edit')(SocketPosts);
require('./posts/move')(SocketPosts);
require('./posts/favourites')(SocketPosts);
require('./posts/tools')(SocketPosts);
require('./posts/flag')(SocketPosts);

SocketPosts.reply = function(socket, data, callback) {
	if (!data || !data.tid || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);

	topics.reply(data, function(err, postData) {
		if (err) {
			return callback(err);
		}

		var result = {
			posts: [postData],
			privileges: {
				'topics:reply': true
			},
			'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
			'downvote:disabled': parseInt(meta.config['downvote:disabled'], 10) === 1,
		};

		callback(null, postData);

		socket.emit('event:new_post', result);

		user.updateOnlineUsers(socket.uid);

		socketHelpers.notifyOnlineUsers(socket.uid, result);

		if (data.lock) {
			socketTopics.doTopicAction('lock', 'event:topic_locked', socket, {tids: [postData.topic.tid], cid: postData.topic.cid});
		}
	});
};

SocketPosts.getRawPost = function(socket, pid, callback) {
	async.waterfall([
		function(next) {
			privileges.posts.can('read', pid, socket.uid, next);
		},
		function(canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			posts.getPostFields(pid, ['content', 'deleted'], next);
		},
		function(postData, next) {
			if (parseInt(postData.deleted, 10) === 1) {
				return next(new Error('[[error:no-post]]'));
			}
			next(null, postData.content);
		}
	], callback);
};

SocketPosts.loadMoreFavourites = function(socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':favourites', socket.uid, data, callback);
};

SocketPosts.loadMoreUserPosts = function(socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':posts', socket.uid, data, callback);
};

function loadMorePosts(set, uid, data, callback) {
	if (!data || !utils.isNumber(data.uid) || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = Math.max(0, parseInt(data.after, 10)),
		stop = start + 9;

	posts.getPostSummariesFromSet(set, uid, start, stop, callback);
}

SocketPosts.getCategory = function(socket, pid, callback) {
	posts.getCidByPid(pid, callback);
};

SocketPosts.getPidIndex = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	posts.getPidIndex(data.pid, data.tid, data.topicPostSort, callback);
};

module.exports = SocketPosts;
