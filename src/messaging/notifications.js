'use strict';

var async = require('async');
var nconf = require('nconf');
var winston = require('winston');

var user = require('../user');
var emailer = require('../emailer');
var notifications = require('../notifications');
var meta = require('../meta');
var sockets = require('../socket.io');
var plugins = require('../plugins');

module.exports = function (Messaging) {
	Messaging.notifyQueue = {};	// Only used to notify a user of a new chat message, see Messaging.notifyUser

	Messaging.notificationSendDelay = 1000 * 60;

	Messaging.notifyUsersInRoom = function (fromUid, roomId, messageObj) {
		async.waterfall([
			function (next) {
				Messaging.getUidsInRoom(roomId, 0, -1, next);
			},
			function (uids, next) {
				var data = {
					roomId: roomId,
					fromUid: fromUid,
					message: messageObj,
					uids: uids,
				};

				plugins.fireHook('filter:messaging.notify', data, next);
			},
			function (data, next) {
				if (!data || !data.uids || !data.uids.length) {
					return next();
				}

				var uids = data.uids;

				uids.forEach(function (uid) {
					data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;
					Messaging.pushUnreadCount(uid);
					sockets.in('uid_' + uid).emit('event:chats.receive', data);
				});

				// Delayed notifications
				var queueObj = Messaging.notifyQueue[fromUid + ':' + roomId];
				if (queueObj) {
					queueObj.message.content += '\n' + messageObj.content;
					clearTimeout(queueObj.timeout);
				} else {
					queueObj = {
						message: messageObj,
					};
					Messaging.notifyQueue[fromUid + ':' + roomId] = queueObj;
				}

				queueObj.timeout = setTimeout(function () {
					sendNotifications(fromUid, uids, roomId, queueObj.message);
				}, Messaging.notificationSendDelay);
				next();
			},
		]);
	};

	function sendNotifications(fromuid, uids, roomId, messageObj) {
		async.waterfall([
			function (next) {
				user.isOnline(uids, next);
			},
			function (isOnline, next) {
				uids = uids.filter(function (uid, index) {
					return !isOnline[index] && parseInt(fromuid, 10) !== parseInt(uid, 10);
				});

				if (!uids.length) {
					return;
				}

				notifications.create({
					type: 'new-chat',
					bodyShort: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
					bodyLong: messageObj.content,
					nid: 'chat_' + fromuid + '_' + roomId,
					from: fromuid,
					path: '/chats/' + messageObj.roomId,
				}, next);
			},
		], function (err, notification) {
			if (!err) {
				delete Messaging.notifyQueue[fromuid + ':' + roomId];
				if (notification) {
					notifications.push(notification, uids);
				}
				sendNotificationEmails(uids, messageObj);
			}
		});
	}

	function sendNotificationEmails(uids, messageObj) {
		if (parseInt(meta.config.disableEmailSubscriptions, 10) === 1) {
			return;
		}

		async.waterfall([
			function (next) {
				async.parallel({
					userData: function (next) {
						user.getUsersFields(uids, ['uid', 'username', 'userslug'], next);
					},
					userSettings: function (next) {
						user.getMultipleUserSettings(uids, next);
					},
				}, next);
			},

			function (results, next) {
				results.userData = results.userData.filter(function (userData, index) {
					return userData && results.userSettings[index] && results.userSettings[index].sendChatNotifications;
				});
				async.each(results.userData, function (userData, next) {
					emailer.send('notif_chat', userData.uid, {
						subject: '[[email:notif.chat.subject, ' + messageObj.fromUser.username + ']]',
						summary: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
						message: messageObj,
						site_title: meta.config.title || 'NodeBB',
						url: nconf.get('url'),
						roomId: messageObj.roomId,
						username: userData.username,
						userslug: userData.userslug,
					}, next);
				}, next);
			},
		], function (err) {
			if (err) {
				return winston.error(err);
			}
		});
	}
};
