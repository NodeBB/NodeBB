'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Chat room hashes',
    timestamp: Date.UTC(2015, 11, 23),
    method: function (callback) {
        db.getObjectField('global', 'nextChatRoomId', (err, nextChatRoomId) => {
            if (err) {
                return callback(err);
            }
            let currentChatRoomId = 1;
            async.whilst((next) => {
                next(null, currentChatRoomId <= nextChatRoomId);
            }, (next) => {
                db.getSortedSetRange(`chat:room:${currentChatRoomId}:uids`, 0, 0, (err, uids) => {
                    if (err) {
                        return next(err);
                    }
                    if (!Array.isArray(uids) || !uids.length || !uids[0]) {
                        currentChatRoomId += 1;
                        return next();
                    }
                    db.setObject(`chat:room:${currentChatRoomId}`, { owner: uids[0], roomId: currentChatRoomId }, (err) => {
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
