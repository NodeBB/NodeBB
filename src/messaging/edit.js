'use strict';

var async = require('async');

var meta = require('../meta');
var user = require('../user');

var sockets = require('../socket.io');


module.exports = function (Messaging) {
	Messaging.editMessage = function (uid, mid, roomId, content, callback) {
		var uids;
		async.waterfall([
			function (next) {
				Messaging.getMessageField(mid, 'content', next);
			},
			function (raw, next) {
				if (raw === content) {
					return callback();
				}

				Messaging.setMessageFields(mid, {
					content: content,
					edited: Date.now(),
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
				uids.forEach(function (uid) {
					sockets.in('uid_' + uid).emit('event:chats.edit', {
						messages: messages,
					});
				});
				next();
			},
		], callback);
	};

	Messaging.canEdit = function (messageId, uid, callback) {
		canEditDelete(messageId, uid, 'edit', callback);
	};

	Messaging.canDelete = function (messageId, uid, callback) {
		canEditDelete(messageId, uid, 'delete', callback);
	};

	function canEditDelete(messageId, uid, type, callback) {
		var durationConfig = '';
		if (type === 'edit') {
			durationConfig = 'chatEditDuration';
		} else if (type === 'delete') {
			durationConfig = 'chatDeleteDuration';
		}

		if (parseInt(meta.config.disableChat, 10) === 1) {
			return callback(new Error('[[error:chat-disabled]]'));
		} else if (parseInt(meta.config.disableChatMessageEditing, 10) === 1) {
			return callback(new Error('[[error:chat-message-editing-disabled]]'));
		}

		async.waterfall([
			function (next) {
				user.getUserFields(uid, ['banned', 'email:confirmed'], next);
			},
			function (userData, next) {
				if (parseInt(userData.banned, 10) === 1) {
					return callback(new Error('[[error:user-banned]]'));
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return callback(new Error('[[error:email-not-confirmed]]'));
				}
				async.parallel({
					isAdmin: function (next) {
						user.isAdministrator(uid, next);
					},
					messageData: function (next) {
						Messaging.getMessageFields(messageId, ['fromuid', 'timestamp'], next);
					},
				}, next);
			},
			function (results, next) {
				if (results.isAdmin) {
					return callback();
				}
				var chatConfigDuration = parseInt(meta.config[durationConfig], 10);
				if (chatConfigDuration && Date.now() - parseInt(results.messageData.timestamp, 10) > chatConfigDuration * 1000) {
					return callback(new Error('[[error:chat-' + type + '-duration-expired, ' + meta.config[durationConfig] + ']]'));
				}

				if (parseInt(results.messageData.fromuid, 10) === parseInt(uid, 10)) {
					return callback();
				}

				next(new Error('[[error:cant-' + type + '-chat-message]]'));
			},
		], callback);
	}
};
