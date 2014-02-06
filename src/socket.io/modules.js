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
	server = require('./'),

	SocketModules = {};

/* Posts Composer */

SocketModules.composer = {};

SocketModules.composer.push = function(socket, pid, callback) {
	if (socket.uid || parseInt(meta.config.allowGuestPosting, 10)) {
		if (parseInt(pid, 10) > 0) {

			async.parallel([
				function(next) {
					posts.getPostFields(pid, ['content'], next);
				},
				function(next) {
					topics.getTitleByPid(pid, function(title) {
						next(null, title);
					});
				}
			], function(err, results) {
				if(err) {
					return callback(err);
				}

				callback(null, {
					title: results[1],
					pid: pid,
					body: results[0].content
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
}

/* Chat */

SocketModules.chats = {};

SocketModules.chats.get = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	Messaging.getMessages(socket.uid, data.touid, callback);
};

SocketModules.chats.send = function(socket, data) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	var touid = data.touid;
	if (touid === socket.uid || socket.uid === 0) {
		return;
	}

	var msg = S(data.message).stripTags().s;

	user.getMultipleUserFields([socket.uid, touid], ['username', 'picture'], function(err, usersData) {
		if(err) {
			return;
		}

		var username = usersData[0].username,
			toUsername = usersData[1].username,
			finalMessage = username + ' : ' + msg,
			notifText = 'New message from <strong>' + username + '</strong>';

		if (!module.parent.exports.isUserOnline(touid)) {
			notifications.create(notifText, 'javascript:app.openChat(&apos;' + username + '&apos;, ' + socket.uid + ');', 'notification_' + socket.uid + '_' + touid, function(nid) {
				notifications.push(nid, [touid], function(success) {

				});
			});
		}

		usersData[0].uid = socket.uid;
		usersData[1].uid = touid;

		Messaging.parse(msg, socket.uid, socket.uid, usersData[1], usersData[0], true, function(parsed) {
			Messaging.addMessage(socket.uid, touid, msg, function(err, message) {


				server.getUserSockets(touid).forEach(function(s) {
					s.emit('event:chats.receive', {
						fromuid: socket.uid,
						username: username,
						message: parsed,
						timestamp: Date.now()
					});
				});

				server.getUserSockets(socket.uid).forEach(function(s) {
					s.emit('event:chats.receive', {
						fromuid: touid,
						username: toUsername,
						message: parsed,
						timestamp: Date.now()
					});
				});
			});
		});
	});
};

SocketModules.chats.list = function(socket, data, callback) {
	Messaging.getRecentChats(socket.uid, callback);
};

/* Notifications */

SocketModules.notifications = {};

SocketModules.notifications.mark_read = function(socket, nid) {
	notifications.mark_read(nid, socket.uid);
};

SocketModules.notifications.mark_all_read = function(socket, data, callback) {
	notifications.mark_all_read(socket.uid, callback);
};

module.exports = SocketModules;