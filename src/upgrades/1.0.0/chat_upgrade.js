'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Upgrading chats',
	timestamp: Date.UTC(2015, 11, 15),
	method: function (callback) {
		db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], (err, globalData) => {
			if (err) {
				return callback(err);
			}

			const rooms = {};
			let roomId = globalData.nextChatRoomId || 1;
			let currentMid = 1;

			async.whilst((next) => {
				next(null, currentMid <= globalData.nextMid);
			}, (next) => {
				db.getObject(`message:${currentMid}`, (err, message) => {
					if (err || !message) {
						winston.verbose('skipping chat message ', currentMid);
						currentMid += 1;
						return next(err);
					}

					const pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
					const msgTime = parseInt(message.timestamp, 10);

					function addMessageToUids(roomId, callback) {
						async.parallel([
							function (next) {
								db.sortedSetAdd(`uid:${message.fromuid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
							},
							function (next) {
								db.sortedSetAdd(`uid:${message.touid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
							},
						], callback);
					}

					if (rooms[pairID]) {
						winston.verbose(`adding message ${currentMid} to existing roomID ${roomId}`);
						addMessageToUids(rooms[pairID], (err) => {
							if (err) {
								return next(err);
							}
							currentMid += 1;
							next();
						});
					} else {
						winston.verbose(`adding message ${currentMid} to new roomID ${roomId}`);
						async.parallel([
							function (next) {
								db.sortedSetAdd(`uid:${message.fromuid}:chat:rooms`, msgTime, roomId, next);
							},
							function (next) {
								db.sortedSetAdd(`uid:${message.touid}:chat:rooms`, msgTime, roomId, next);
							},
							function (next) {
								db.sortedSetAdd(`chat:room:${roomId}:uids`, [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
							},
							function (next) {
								addMessageToUids(roomId, next);
							},
						], (err) => {
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
