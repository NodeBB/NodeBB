'use strict';

var async = require('async');

var meta = require('../meta');
var user = require('../user');

var sockets = require('../socket.io');


module.exports = function(Messaging) {

	Messaging.editMessage = function(uid, mid, roomId, content, callback) {
		var uids;
		async.waterfall([
			function(next) {
				Messaging.getMessageField(mid, 'content', next);
			},
			function (raw, next) {
				if (raw === content) {
					return callback();
				}

				Messaging.setMessageFields(mid, {
					content: content,
					edited: Date.now()
				}, next);
			},
			function (next) {
				Messaging.getUidsInRoom(roomId, 0, -1, next);
			},
			function (_uids, next) {
				uids = _uids;
				Messaging.getMessagesData([mid], uid, roomId, true, next);
			},
			function (messages, next) {
				uids.forEach(function(uid) {
					sockets.in('uid_' + uid).emit('event:chats.edit', {
						messages: messages
					});
				});
				next();
			}
		], callback);
	};

	Messaging.canEdit = function(messageId, uid, callback) {
		if (parseInt(meta.config.disableChat) === 1) {
			return callback(null, false);
		}

		async.waterfall([
			function (next) {
				user.getUserFields(uid, ['banned', 'email:confirmed'], next);
			},
			function (userData, next) {
				if (parseInt(userData.banned, 10) === 1) {
					return callback(null, false);
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return callback(null, false);
				}

				Messaging.getMessageField(messageId, 'fromuid', next);
			},
			function(fromUid, next) {
				if (parseInt(fromUid, 10) === parseInt(uid, 10)) {
					return callback(null, true);
				}

				user.isAdministrator(uid, next);
			},
			function(isAdmin, next) {
				next(null, isAdmin);
			}
		], callback);
	};

};