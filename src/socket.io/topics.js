
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

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);
	data.timestamp = Date.now();

	topics.post(data, function(err, result) {
		if (err) {
			return callback(err);
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

	topics.createTopicFromPosts(socket.uid, data.title, data.pids, data.fromTid, callback);
};

SocketTopics.changeWatching = function(socket, data, callback) {
	if (!data.tid || !data.type) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var commands = ['follow', 'unfollow', 'ignore'];
	if (commands.indexOf(data.type) === -1) {
		return callback(new Error('[[error:invalid-command]]'));
	}
	followCommand(topics[data.type], socket, data.tid, callback);
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

SocketTopics.isFollowed = function(socket, tid, callback) {
	topics.isFollowing([tid], socket.uid, function(err, isFollowing) {
		callback(err, Array.isArray(isFollowing) && isFollowing.length ? isFollowing[0] : false);
	});
};

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
	apiController.getTopicData(tid, socket.uid, callback);
};

module.exports = SocketTopics;
