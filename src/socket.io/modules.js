"use strict";

var	posts = require('../posts'),
	postTools = require('../postTools'),
	topics = require('../topics'),
	meta = require('../meta'),
	Messaging = require('../messaging'),
	user = require('../user'),
	notifications = require('../notifications'),
	plugins = require('../plugins'),

	async = require('async'),
	S = require('string'),
	winston = require('winston'),
	_ = require('underscore'),
	server = require('./'),

	SocketModules = {
		composer: {
			replyHash: {}
		},
		chats: {},
		notifications: {},
		sounds: {},
		settings: {}
	};

/* Posts Composer */

var	stopTracking = function(replyObj) {
		if (isLast(replyObj.uid, replyObj.tid)) {
			server.in('topic_' + replyObj.tid).emit('event:topic.replyStop', replyObj.uid);
		}

		clearInterval(replyObj.timer);
		delete SocketModules.composer.replyHash[replyObj.uuid];
	},
	isLast = function(uid, tid) {
		return _.filter(SocketModules.composer.replyHash, function(replyObj, uuid) {
			if (
				parseInt(replyObj.tid, 10) === parseInt(tid, 10) &&
				parseInt(replyObj.uid, 10) === parseInt(uid, 10)
			) {
				return true;
			} else {
				return false;
			}
		}).length === 1;
	};

SocketModules.composer.push = function(socket, pid, callback) {
	if (socket.uid || parseInt(meta.config.allowGuestPosting, 10)) {
		if (parseInt(pid, 10) > 0) {

			async.parallel([
				function(next) {
					posts.getPostFields(pid, ['content'], next);
				},
				function(next) {
					topics.getTopicDataByPid(pid, next);
				},
				function(next) {
					posts.getPidIndex(pid, next);
				}
			], function(err, results) {
				if(err) {
					return callback(err);
				}
				callback(null, {
					pid: pid,
					body: results[0].content,
					title: results[1].title,
					topic_thumb: results[1].thumb,
					index: results[2]
				});
			});
		}
	} else {
		callback(new Error('no-uid'));
	}
};

SocketModules.composer.editCheck = function(socket, pid, callback) {
	posts.getPostField(pid, 'tid', function(err, tid) {
		if (err) {
			return callback(err);
		}

		postTools.isMain(pid, tid, function(err, isMain) {
			callback(err, {
				titleEditable: isMain
			});
		});
	});
};

SocketModules.composer.renderPreview = function(socket, content, callback) {
	plugins.fireHook('filter:post.parse', content, callback);
};

SocketModules.composer.renderHelp = function(socket, data, callback) {
	plugins.fireHook('filter:composer.help', '', callback);
};

SocketModules.composer.register = function(socket, data) {
	var	now = Date.now();

	server.in('topic_' + data.tid).emit('event:topic.replyStart', data.uid);

	data.socket = socket;
	data.lastPing = now;
	data.lastAnswer = now;
	data.timer = setInterval(function() {
		if (data.lastPing === data.lastAnswer) {
			// Ping the socket to see if the composer is still active
			data.lastPing = Date.now();
			socket.emit('event:composer.ping', data.uuid);
		} else {
			stopTracking(data);
		}
	}, 1000*5);	// Every 5 seconds...

	SocketModules.composer.replyHash[data.uuid] = data;
};

SocketModules.composer.unregister = function(socket, uuid) {
	var	replyObj = SocketModules.composer.replyHash[uuid];
	if (uuid && replyObj) {
		stopTracking(replyObj);
	}
};

SocketModules.composer.pingActive = function(socket, uuid) {
	var	data = SocketModules.composer.replyHash[uuid];
	if (data) {
		data.lastAnswer = data.lastPing;
	}
};

SocketModules.composer.getUsersByTid = function(socket, tid, callback) {
	// Return uids with active composers
	callback(null, _.filter(SocketModules.composer.replyHash, function(replyObj, uuid) {
		return parseInt(replyObj.tid, 10) === parseInt(tid, 10);
	}).map(function(replyObj) {
		return replyObj.uid;
	}));
};

/* Chat */

SocketModules.chats.get = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	Messaging.getMessages(socket.uid, data.touid, false, callback);
};

SocketModules.chats.send = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	var touid = data.touid;
	if (touid === socket.uid || socket.uid === 0) {
		return;
	}

	var msg = S(data.message).stripTags().s;

	Messaging.addMessage(socket.uid, touid, msg, function(err, message) {
		if (err) {
			return callback(err);
		}

		sendChatNotification(socket.uid, touid, message.user.username);

		server.getUserSockets(touid).forEach(function(s) {
			s.emit('event:chats.receive', {
				withUid: socket.uid,
				message: message
			});
		});

		server.getUserSockets(socket.uid).forEach(function(s) {
			s.emit('event:chats.receive', {
				withUid: touid,
				message: message
			});
		});
	});
};

function sendChatNotification(fromuid, touid, username) {
	if (!module.parent.exports.isUserOnline(touid)) {
		var notifText = 'New message from <strong>' + username + '</strong>';
		notifications.create({
			text: notifText,
			path: 'javascript:app.openChat(&apos;' + username + '&apos;, ' + fromuid + ');',
			uniqueId: 'notification_' + fromuid + '_' + touid,
			from: fromuid
		}, function(nid) {
			notifications.push(nid, [touid], function(success) {

			});
		});
	}
}

SocketModules.chats.list = function(socket, data, callback) {
	Messaging.getRecentChats(socket.uid, callback);
};

/* Notifications */
SocketModules.notifications.mark_read = function(socket, nid) {
	notifications.mark_read(nid, socket.uid);
};

SocketModules.notifications.mark_all_read = function(socket, data, callback) {
	notifications.mark_all_read(socket.uid, callback);
};

/* Sounds */
SocketModules.sounds.getSounds = function(socket, data, callback) {
	// Read sounds from local directory
	meta.sounds.getLocal(callback);
};

SocketModules.sounds.getMapping = function(socket, data, callback) {
	meta.sounds.getMapping(callback);
};

module.exports = SocketModules;