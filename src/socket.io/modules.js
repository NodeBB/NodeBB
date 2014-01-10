"use strict";

var	posts = require('../posts'),
	postTools = require('../postTools'),
	topics = require('../topics'),
	meta = require('../meta'),
	Messaging = require('../messaging'),
	user = require('../user'),
	notifications = require('../notifications'),

	async = require('async'),
	S = require('string'),
	winston = require('winston'),

	SocketModules = {};

/* Posts Composer */

SocketModules.composer = {};

SocketModules.composer.push = function(data, callback, sessionData) {
	if (parseInt(sessionData.uid, 10) > 0 || parseInt(meta.config.allowGuestPosting, 10) === 1) {
		if (parseInt(data.pid, 10) > 0) {

			async.parallel([
				function(next) {
					posts.getPostFields(data.pid, ['content'], next);
				},
				function(next) {
					topics.getTitleByPid(data.pid, function(title) {
						next(null, title);
					});
				}
			], function(err, results) {
				callback({
					title: results[1],
					pid: data.pid,
					body: results[0].content
				});
			});
		}
	} else {
		callback({
			error: 'no-uid'
		});
	}
};

SocketModules.composer.editCheck = function(pid, callback) {
	posts.getPostField(pid, 'tid', function(err, tid) {
		postTools.isMain(pid, tid, function(err, isMain) {
			callback({
				titleEditable: isMain
			});
		});
	});
};

/* Chat */

SocketModules.chats = {};

SocketModules.chats.get = function(data, callback, sessionData) {
	var touid = data.touid;
	Messaging.getMessages(sessionData.uid, touid, function(err, messages) {
		if (err) {
			return callback(null);
		}

		callback(messages);
	});
};

SocketModules.chats.send = function(data, sessionData) {

	var touid = data.touid;
	if (touid === sessionData.uid || sessionData.uid === 0) {
		return;
	}

	var msg = S(data.message).stripTags().s;

	user.getMultipleUserFields([sessionData.uid, touid], ['username'], function(err, usersData) {
		if(err) {
			return;
		}

		var username = usersData[0].username,
			toUsername = usersData[1].username,
			finalMessage = username + ' : ' + msg,
			notifText = 'New message from <strong>' + username + '</strong>';

		if (!module.parent.exports.isUserOnline(touid)) {
			notifications.create(notifText, 'javascript:app.openChat(&apos;' + username + '&apos;, ' + sessionData.uid + ');', 'notification_' + sessionData.uid + '_' + touid, function(nid) {
				notifications.push(nid, [touid], function(success) {

				});
			});
		}

		Messaging.addMessage(sessionData.uid, touid, msg, function(err, message) {
			var numSockets = 0,
				x;

			if (sessionData.userSockets[touid]) {
				numSockets = sessionData.userSockets[touid].length;

				for (x = 0; x < numSockets; ++x) {
					sessionData.userSockets[touid][x].emit('event:chats.receive', {
						fromuid: sessionData.uid,
						username: username,
						message: finalMessage,
						timestamp: Date.now()
					});
				}
			}

			if (sessionData.userSockets[sessionData.uid]) {

				numSockets = sessionData.userSockets[sessionData.uid].length;

				for (x = 0; x < numSockets; ++x) {
					sessionData.userSockets[sessionData.uid][x].emit('event:chats.receive', {
						fromuid: touid,
						username: toUsername,
						message: 'You : ' + msg,
						timestamp: Date.now()
					});
				}
			}
		});
	});
};

SocketModules.chats.list = function(callback, sessionData) {
	Messaging.getRecentChats(sessionData.uid, function(err, uids) {
		if (err) {
			winston.warn('[(socket) api:chats.list] Problem retrieving chats: ' + err.message);
		}

		callback(uids || []);
	});
};

/* Notifications */

SocketModules.notifications = {};

SocketModules.notifications.mark_read = function(nid, sessionData) {
	notifications.mark_read(nid, sessionData.uid);
};

SocketModules.notifications.mark_all_read = function(data, callback, sessionData) {
	notifications.mark_all_read(sessionData.uid, function(err) {
		if (!err) {
			callback();
		}
	});
};

module.exports = SocketModules;