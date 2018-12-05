'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Upgrading chats',
	timestamp: Date.UTC(2015, 11, 15),
	method: function (callback) {
		db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], function (err, globalData) {
			if (err) {
				return callback(err);
			}

			var rooms = {};
			var roomId = globalData.nextChatRoomId || 1;
			var currentMid = 1;

			async.whilst(function () {
				return currentMid <= globalData.nextMid;
			}, function (next) {
				db.getObject('message:' + currentMid, function (err, message) {
					var msgTime;

					function addMessageToUids(roomId, callback) {
						async.parallel([
							function (next) {
								db.sortedSetAdd('uid:' + message.fromuid + ':chat:room:' + roomId + ':mids', msgTime, currentMid, next);
							},
							function (next) {
								db.sortedSetAdd('uid:' + message.touid + ':chat:room:' + roomId + ':mids', msgTime, currentMid, next);
							},
						], callback);
					}

					if (err || !message) {
						winston.verbose('skipping chat message ', currentMid);
						currentMid += 1;
						return next(err);
					}

					var pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
					msgTime = parseInt(message.timestamp, 10);

					if (rooms[pairID]) {
						winston.verbose('adding message ' + currentMid + ' to existing roomID ' + roomId);
						addMessageToUids(rooms[pairID], function (err) {
							if (err) {
								return next(err);
							}
							currentMid += 1;
							next();
						});
					} else {
						winston.verbose('adding message ' + currentMid + ' to new roomID ' + roomId);
						async.parallel([
							function (next) {
								db.sortedSetAdd('uid:' + message.fromuid + ':chat:rooms', msgTime, roomId, next);
							},
							function (next) {
								db.sortedSetAdd('uid:' + message.touid + ':chat:rooms', msgTime, roomId, next);
							},
							function (next) {
								db.sortedSetAdd('chat:room:' + roomId + ':uids', [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
							},
							function (next) {
								addMessageToUids(roomId, next);
							},
						], function (err) {
							if (err) {
								return next(err);
							}
							rooms[pairID] = roomId;
							roomId += 1;
							currentMid += 1;
							db.setObjectField('global', 'nextChatRoomId', roomId, next);
						});
					}
				});
			}, callback);
		});
	},
};
