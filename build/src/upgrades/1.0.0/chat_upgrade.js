'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Upgrading chats',
    timestamp: Date.UTC(2015, 11, 15),
    method: function (callback) {
        database_1.default.getObjectFields('global', ['nextMid', 'nextChatRoomId'], (err, globalData) => {
            if (err) {
                return callback(err);
            }
            const rooms = {};
            let roomId = globalData.nextChatRoomId || 1;
            let currentMid = 1;
            async.whilst((next) => {
                next(null, currentMid <= globalData.nextMid);
            }, (next) => {
                database_1.default.getObject(`message:${currentMid}`, (err, message) => {
                    if (err || !message) {
                        winston_1.default.verbose('skipping chat message ', currentMid);
                        currentMid += 1;
                        return next(err);
                    }
                    const pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
                    const msgTime = parseInt(message.timestamp, 10);
                    function addMessageToUids(roomId, callback) {
                        async.parallel([
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.fromuid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.touid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
                            },
                        ], callback);
                    }
                    if (rooms[pairID]) {
                        winston_1.default.verbose(`adding message ${currentMid} to existing roomID ${roomId}`);
                        addMessageToUids(rooms[pairID], (err) => {
                            if (err) {
                                return next(err);
                            }
                            currentMid += 1;
                            next();
                        });
                    }
                    else {
                        winston_1.default.verbose(`adding message ${currentMid} to new roomID ${roomId}`);
                        async.parallel([
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.fromuid}:chat:rooms`, msgTime, roomId, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.touid}:chat:rooms`, msgTime, roomId, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`chat:room:${roomId}:uids`, [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
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
                            database_1.default.setObjectField('global', 'nextChatRoomId', roomId, next);
                        });
                    }
                });
            }, callback);
        });
    },
};
