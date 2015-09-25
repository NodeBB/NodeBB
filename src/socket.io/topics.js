
'use strict';

var nconf = require('nconf'),
	async = require('async'),
	winston = require('winston'),

	topics = require('../topics'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	notifications = require('../notifications'),
	websockets = require('./index'),
	user = require('../user'),

	SocketTopics = {};

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

		async.waterfall([
			function(next) {
				user.getUidsFromSet('users:online', 0, -1, next);
			},
			function(uids, next) {
				privileges.categories.filterUids('read', result.topicData.cid, uids, next);
			},
			function(uids, next) {
				plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: data.uid, type: 'newTopic'}, next);
			}
		], function(err, data) {
			if (err) {
				return winston.error(err.stack);
			}

			var uids = data.uidsTo;

			for(var i=0; i<uids.length; ++i) {
				if (parseInt(uids[i], 10) !== socket.uid) {
					websockets.in('uid_' + uids[i]).emit('event:new_post', {posts: [result.postData]});
					websockets.in('uid_' + uids[i]).emit('event:new_topic', result.topicData);
				}
			}
		});
	});
};

SocketTopics.enter = function(socket, tid, callback) {
	if (!parseInt(tid, 10) || !socket.uid) {
		return;
	}
	async.parallel({
		markAsRead: function(next) {
			SocketTopics.markAsRead(socket, [tid], next);
		},
		users: function(next) {
			websockets.getUsersInRoom(socket.uid, 'topic_' + tid, 0, 9, next);
		}
	}, function(err, result) {
		callback(err, result ? result.users : null);
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


SocketTopics.emitToTopicAndCategory = function(event, data) {
	websockets.in('topic_' + data.tid).emit(event, data);
	websockets.in('category_' + data.cid).emit(event, data);
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

SocketTopics.sendNotificationToTopicOwner = function(tid, fromuid, notification) {
	if (!tid || !fromuid) {
		return;
	}

	async.parallel({
		username: async.apply(user.getUserField, fromuid, 'username'),
		topicData: async.apply(topics.getTopicFields, tid, ['uid', 'slug']),
	}, function(err, results) {
		if (err || fromuid === parseInt(results.topicData.uid, 10)) {
			return;
		}

		notifications.create({
			bodyShort: '[[' + notification + ', ' + results.username + ']]',
			path: nconf.get('relative_path') + '/topic/' + results.topicData.slug,
			nid: 'tid:' + tid + ':uid:' + fromuid,
			from: fromuid
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [results.topicData.uid]);
			}
		});
	});
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

	topics[method](tid, socket.uid, callback);
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

module.exports = SocketTopics;
