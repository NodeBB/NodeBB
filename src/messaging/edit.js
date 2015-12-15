'use strict';

var async = require('async');

var meta = require('../meta');
var user = require('../user');

var sockets = require('../socket.io');


module.exports = function(Messaging) {

	Messaging.editMessage = function(mid, content, callback) {
		async.series([
			function(next) {
				// Verify that the message actually changed
				Messaging.getMessageField(mid, 'content', function(err, raw) {
					if (raw === content) {
						// No dice.
						return callback();
					}

					next();
				});
			},
			async.apply(Messaging.setMessageFields, mid, {
				content: content,
				edited: Date.now()
			}),
			function(next) {
				Messaging.getMessageFields(mid, ['fromuid', 'touid'], function(err, data) {
					Messaging.getMessagesData([mid], data.fromuid, data.touid, true, function(err, messages) {
						sockets.in('uid_' + data.fromuid).emit('event:chats.edit', {
							messages: messages
						});
						sockets.in('uid_' + data.touid).emit('event:chats.edit', {
							messages: messages
						});
						next();
					});
				});
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