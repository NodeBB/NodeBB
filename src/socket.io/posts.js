"use strict";

var	async = require('async'),

	winston = require('winston'),


	posts = require('../posts'),
	plugins = require('../plugins'),
	privileges = require('../privileges'),
	meta = require('../meta'),
	topics = require('../topics'),
	notifications = require('../notifications'),
	user = require('../user'),
	websockets = require('./index'),
	socketTopics = require('./topics'),
	utils = require('../../public/src/utils'),

	SocketPosts = {};


require('./posts/edit')(SocketPosts);
require('./posts/move')(SocketPosts);
require('./posts/favourites')(SocketPosts);
require('./posts/tools')(SocketPosts);
require('./posts/flag')(SocketPosts);

SocketPosts.reply = function(socket, data, callback) {
	if(!data || !data.tid || !data.content) {
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

		SocketPosts.notifyOnlineUsers(socket.uid, result);

		if (data.lock) {
			socketTopics.doTopicAction('lock', 'event:topic_locked', socket, {tids: [postData.topic.tid], cid: postData.topic.cid});
		}
	});
};

SocketPosts.notifyOnlineUsers = function(uid, result) {
	var cid = result.posts[0].topic.cid;
	async.waterfall([
		function(next) {
			user.getUidsFromSet('users:online', 0, -1, next);
		},
		function(uids, next) {
			privileges.categories.filterUids('read', cid, uids, next);
		},
		function(uids, next) {
			plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: uid, type: 'newPost'}, next);
		}
	], function(err, data) {
		if (err) {
			return winston.error(err.stack);
		}

		var uids = data.uidsTo;

		for(var i=0; i<uids.length; ++i) {
			if (parseInt(uids[i], 10) !== uid) {
				websockets.in('uid_' + uids[i]).emit('event:new_post', result);
			}
		}
	});
};

SocketPosts.sendNotificationToPostOwner = function(pid, fromuid, notification) {
	if(!pid || !fromuid || !notification) {
		return;
	}
	posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
		if (err) {
			return;
		}

		if (!postData.uid || fromuid === parseInt(postData.uid, 10)) {
			return;
		}

		async.parallel({
			username: async.apply(user.getUserField, fromuid, 'username'),
			topicTitle: async.apply(topics.getTopicField, postData.tid, 'title'),
			postObj: async.apply(posts.parsePost, postData)
		}, function(err, results) {
			if (err) {
				return;
			}

			notifications.create({
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + results.topicTitle + ']]',
				bodyLong: results.postObj.content,
				pid: pid,
				nid: 'post:' + pid + ':uid:' + fromuid,
				from: fromuid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, [postData.uid]);
				}
			});
		});
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

SocketPosts.getPrivileges = function(socket, pids, callback) {
	privileges.posts.get(pids, socket.uid, function(err, privileges) {
		if (err) {
			return callback(err);
		}
		if (!Array.isArray(privileges) || !privileges.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		callback(null, privileges);
	});
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
