
'use strict';

var async = require('async');

var topics = require('../topics');
var websockets = require('./index');
var user = require('../user');
var apiController = require('../controllers/api');
var socketHelpers = require('./helpers');

var SocketTopics = {};

require('./topics/unread')(SocketTopics);
require('./topics/move')(SocketTopics);
require('./topics/tools')(SocketTopics);
require('./topics/infinitescroll')(SocketTopics);
require('./topics/tags')(SocketTopics);

SocketTopics.post = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.post({
		uid: socket.uid,
		handle: data.handle,
		title: data.title,
		content: data.content,
		cid: data.category_id,
		thumb: data.topic_thumb,
		tags: data.tags,
		req: websockets.reqFromSocket(socket)
	}, function(err, result) {
		if (err) {
			return callback(err);
		}

		if (data.lock) {
			SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, {tids: [result.topicData.tid], cid: result.topicData.cid});
		}

		callback(null, result.topicData);

		socket.emit('event:new_post', {posts: [result.postData]});
		socket.emit('event:new_topic', result.topicData);

		socketHelpers.notifyNew(socket.uid, 'newTopic', {posts: [result.postData], topic: result.topicData});
	});
};

SocketTopics.postcount = function(socket, tid, callback) {
	topics.getTopicField(tid, 'postcount', callback);
};

SocketTopics.bookmark = function(socket, data, callback) {
	if (!socket.uid || !data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	topics.setUserBookmark(data.tid, socket.uid, data.index, callback);
};

SocketTopics.createTopicFromPosts = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if (!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.createTopicFromPosts(socket.uid, data.title, data.pids, callback);
};

SocketTopics.toggleFollow = function(socket, tid, callback) {
	followCommand(topics.toggleFollow, socket, tid, callback);
};

SocketTopics.follow = function(socket, tid, callback) {
	followCommand(topics.follow, socket, tid, callback);
};

function followCommand(method, socket, tid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	method(tid, socket.uid, callback);
}

SocketTopics.search = function(socket, data, callback) {
	topics.search(data.tid, data.term, callback);
};

SocketTopics.isModerator = function(socket, tid, callback) {
	topics.getTopicField(tid, 'cid', function(err, cid) {
		if (err) {
			return callback(err);
		}
		user.isModerator(socket.uid, cid, callback);
	});
};

SocketTopics.getTopic = function (socket, tid, callback) {
	async.waterfall([
		function (next) {
			apiController.getObjectByType(socket.uid, 'topic', tid, next);
		},
		function (topicData, next) {
			if (parseInt(topicData.deleted, 10) === 1) {
				return next(new Error('[[error:no-topic]]'));
			}
			next(null, topicData);
		}
	], callback);
};

module.exports = SocketTopics;
