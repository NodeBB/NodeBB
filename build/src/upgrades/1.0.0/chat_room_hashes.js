'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Chat room hashes',
    timestamp: Date.UTC(2015, 11, 23),
    method: function (callback) {
        database_1.default.getObjectField('global', 'nextChatRoomId', (err, nextChatRoomId) => {
            if (err) {
                return callback(err);
            }
            let currentChatRoomId = 1;
            async.whilst((next) => {
                next(null, currentChatRoomId <= nextChatRoomId);
            }, (next) => {
                database_1.default.getSortedSetRange(`chat:room:${currentChatRoomId}:uids`, 0, 0, (err, uids) => {
                    if (err) {
                        return next(err);
                    }
                    if (!Array.isArray(uids) || !uids.length || !uids[0]) {
                        currentChatRoomId += 1;
                        return next();
                    }
                    database_1.default.setObject(`chat:room:${currentChatRoomId}`, { owner: uids[0], roomId: currentChatRoomId }, (err) => {
                        if (err) {
                            return next(err);
                        }
                        currentChatRoomId += 1;
                        next();
                    });
                });
            }, callback);
        });
    },
};
