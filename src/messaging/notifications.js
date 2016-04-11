'use strict';

var async = require('async');
var nconf = require('nconf');

var user = require('../user');
var emailer = require('../emailer');
var notifications = require('../notifications');
var meta = require('../meta');
var utils = require('../../public/src/utils');
var sockets = require('../socket.io');

module.exports = function(Messaging) {

	Messaging.notifyQueue = {};	// Only used to notify a user of a new chat message, see Messaging.notifyUser

	Messaging.notifyUsersInRoom = function(fromUid, roomId, messageObj) {
		Messaging.getUidsInRoom(roomId, 0, -1, function(err, uids) {
			if (err) {
				return;
			}

			var data = {
				roomId: roomId,
				fromUid: fromUid,
				message: messageObj
			};
			uids.forEach(function(uid) {
				data.self = parseInt(uid, 10) === parseInt(fromUid) ? 1 : 0;
				Messaging.pushUnreadCount(uid);
				sockets.in('uid_' + uid).emit('event:chats.receive', data);
			});

			// Delayed notifications
			var queueObj = Messaging.notifyQueue[fromUid + ':' + roomId];
			if (queueObj) {
				queueObj.message.content += '\n' + messageObj.content;
				clearTimeout(queueObj.timeout);
			} else {
				queueObj = Messaging.notifyQueue[fromUid + ':' + roomId] = {
					message: messageObj
				};
			}

			queueObj.timeout = setTimeout(function() {
				sendNotifications(fromUid, uids, roomId, queueObj.message, function(err) {
					if (!err) {
						delete Messaging.notifyQueue[fromUid + ':' + roomId];
					}
				});
			}, 1000 * 60); // wait 60s before sending
		});
	};

	function sendNotifications(fromuid, uids, roomId, messageObj, callback) {
		user.isOnline(uids, function(err, isOnline) {
			if (err) {
				return callback(err);
			}

			uids = uids.filter(function(uid, index) {
				return !isOnline[index] && parseInt(fromuid, 10) !== parseInt(uid, 10);
			});

			if (!uids.length) {
				return callback();
			}

			notifications.create({
				bodyShort: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
				bodyLong: messageObj.content,
				nid: 'chat_' + fromuid + '_' + roomId,
				from: fromuid,
				path: '/chats/' + messageObj.roomId
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, uids, callback);
				}
			});

			if (parseInt(meta.config.disableEmailSubscriptions, 10) === 1) {
				return callback();
			}

			user.getMultipleUserSettings(uids, function(err, userSettings) {
				if (err) {
					return callback(err);
				}
				userSettings = userSettings.filter(function(settings) {
					return settings && settings.sendChatNotifications;
				});
				async.each(userSettings, function(settings, next) {
					emailer.send('notif_chat', settings.uid, {
						subject: '[[email:notif.chat.subject, ' + messageObj.fromUser.username + ']]',
						summary: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
						message: messageObj,
						site_title: meta.config.title || 'NodeBB',
						url: nconf.get('url'),
						roomId: messageObj.roomId
					}, next);
				}, callback);
			});
		});
	}
};