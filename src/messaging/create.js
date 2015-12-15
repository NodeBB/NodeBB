'use strict';

var async = require('async');

var meta = require('../meta');
var plugins = require('../plugins');
var db = require('../database');


module.exports = function(Messaging) {


	Messaging.newMessage = function(fromuid, toUids, content, timestamp, callback) {
		var roomId;
		async.waterfall([
			function (next) {
				Messaging.checkContent(content, next);
			},
			function (next) {
				db.incrObjectField('global', 'nextChatRoomId', next);
			},
			function (_roomId, next) {
				roomId = _roomId;
				db.sortedSetAdd('chat:room:' + roomId + ':uids', timestamp, fromuid, next);
			},
			function (next) {
				Messaging.addUsersToRoom(fromuid, toUids, roomId, next);
			},
			function (next) {
				Messaging.sendMessage(fromuid, roomId, content, timestamp, next);
			}
		], callback);
	};

	Messaging.sendMessage = function(fromuid, roomId, content, timestamp, callback) {
		async.waterfall([
			function (next) {
				Messaging.checkContent(content, next);
			},
			function (next) {
				Messaging.roomExists(roomId, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:chat-room-does-not-exist]]'));
				}
				Messaging.addMessage(fromuid, roomId, content, timestamp, next);
			}
		], callback);
	};

	Messaging.checkContent = function(content, callback) {
		if (!content) {
			return callback(new Error('[[error:invalid-chat-message]]'));
		}

		if (content.length > (meta.config.maximumChatMessageLength || 1000)) {
			return callback(new Error('[[error:chat-message-too-long]]'));
		}
	};

	Messaging.addMessage = function(fromuid, roomId, content, timestamp, callback) {
		var mid;
		var message;
		async.waterfall([
			function (next) {
				Messaging.checkContent(content, next);
			},
			function (next) {
				db.incrObjectField('global', 'nextMid', next);
			},
			function (_mid, next) {
				mid = _mid;
				message = {
					content: content,
					timestamp: timestamp,
					fromuid: fromuid,
					roomId: roomId
				};

				plugins.fireHook('filter:messaging.save', message, next);
			},
			function (message, next) {
				db.setObject('message:' + mid, message, next);
			},
			function (next) {
				db.getSortedSetRange('chat:room:' + roomId + ':uids', 0, -1, next);
			},
			function (uids, next) {
				async.parallel([
					async.apply(Messaging.updateChatTime, roomId, uids, timestamp),
					async.apply(Messaging.addMessageToUsers, roomId, uids, mid, timestamp),
					async.apply(Messaging.markRead, fromuid, roomId),
					async.apply(Messaging.markUnread, uids, roomId)
				], next);
			},
			function (results, next) {
				getMessages([mid], fromuid, touid, true, next);
			},
			function (messages, next) {
				Messaging.isNewSet(fromuid, touid, mid, next);
			},
			function (isNewSet, next) {
				if (!messages || !messages[0]) {
					return next(null, null);
				}

				messages[0].newSet = isNewSet;
				messages[0].mid = mid;
				next(null, messages[0]);
			}
		], callback);
	};

	Messaging.updateChatTime = function(roomId, uids, timestamp, callback) {
		if (!uids.length) {
			return callback();
		}
		var keys = uids.map(function(uid) {
			return 'uid:' + uid + ':chat:rooms';
		});
		db.sortedSetsAdd(keys, timestamp, roomId, next);
	};

	Messaging.addMessageToUsers = function(roomId, uids, mid, timestamp, callback) {
		if (!uids.length) {
			return callback();
		}
		var keys = uids.map(function(uid) {
			return 'uid:' + uid + ':chat:room:' + roomId + ':mids';
		});
		db.sortedSetsAdd(keys, timestamp, mid, callback);
	};
};