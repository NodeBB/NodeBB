'use strict';

var async = require('async');

var meta = require('../meta');
var plugins = require('../plugins');
var db = require('../database');
var user = require('../user');

module.exports = function (Messaging) {
	Messaging.sendMessage = function (data, callback) {
		async.waterfall([
			function (next) {
				Messaging.checkContent(data.content, next);
			},
			function (next) {
				Messaging.isUserInRoom(data.uid, data.roomId, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return next(new Error('[[error:not-allowed]]'));
				}

				Messaging.addMessage(data, next);
			},
		], callback);
	};

	Messaging.checkContent = function (content, callback) {
		if (!content) {
			return callback(new Error('[[error:invalid-chat-message]]'));
		}

		plugins.fireHook('filter:messaging.checkContent', { content: content }, function (err, data) {
			if (err) {
				return callback(err);
			}

			content = String(data.content).trim();
			if (!content) {
				return callback(new Error('[[error:invalid-chat-message]]'));
			}

			var maximumChatMessageLength = (meta.config.maximumChatMessageLength || 1000);
			if (content.length > maximumChatMessageLength) {
				return callback(new Error('[[error:chat-message-too-long, ' + maximumChatMessageLength + ']]'));
			}
			callback();
		});
	};

	Messaging.addMessage = function (data, callback) {
		var mid;
		var message;
		var isNewSet;

		async.waterfall([
			function (next) {
				Messaging.checkContent(data.content, next);
			},
			function (next) {
				db.incrObjectField('global', 'nextMid', next);
			},
			function (_mid, next) {
				mid = _mid;
				message = {
					content: String(data.content),
					timestamp: data.timestamp,
					fromuid: data.uid,
					roomId: data.roomId,
					deleted: 0,
				};
				if (data.ip) {
					message.ip = data.ip;
				}

				plugins.fireHook('filter:messaging.save', message, next);
			},
			function (message, next) {
				db.setObject('message:' + mid, message, next);
			},
			function (next) {
				Messaging.isNewSet(data.uid, data.roomId, data.timestamp, next);
			},
			function (_isNewSet, next) {
				isNewSet = _isNewSet;
				db.getSortedSetRange('chat:room:' + data.roomId + ':uids', 0, -1, next);
			},
			function (uids, next) {
				user.blocks.filterUids(data.uid, uids, next);
			},
			function (uids, next) {
				async.parallel([
					async.apply(Messaging.addRoomToUsers, data.roomId, uids, data.timestamp),
					async.apply(Messaging.addMessageToUsers, data.roomId, uids, mid, data.timestamp),
					async.apply(Messaging.markUnread, uids, data.roomId),
				], next);
			},
			function (results, next) {
				async.parallel({
					markRead: async.apply(Messaging.markRead, data.uid, data.roomId),
					messages: async.apply(Messaging.getMessagesData, [mid], data.uid, data.roomId, true),
				}, next);
			},
			function (results, next) {
				if (!results.messages || !results.messages[0]) {
					return next(null, null);
				}

				results.messages[0].newSet = isNewSet;
				results.messages[0].mid = mid;
				results.messages[0].roomId = data.roomId;
				next(null, results.messages[0]);
			},
		], callback);
	};

	Messaging.addRoomToUsers = function (roomId, uids, timestamp, callback) {
		if (!uids.length) {
			return callback();
		}
		const keys = uids.map(uid => 'uid:' + uid + ':chat:rooms');
		db.sortedSetsAdd(keys, timestamp, roomId, callback);
	};

	Messaging.addMessageToUsers = function (roomId, uids, mid, timestamp, callback) {
		if (!uids.length) {
			return callback();
		}
		const keys = uids.map(uid => 'uid:' + uid + ':chat:room:' + roomId + ':mids');
		db.sortedSetsAdd(keys, timestamp, mid, callback);
	};
};
