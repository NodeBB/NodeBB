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
const batch = require('../../batch');
exports.default = {
    name: 'Update moderation notes to zset',
    timestamp: Date.UTC(2017, 2, 22),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('users:joindate', (ids, next) => {
            async.each(ids, (uid, next) => {
                db.getObjectField(`user:${uid}`, 'moderationNote', (err, moderationNote) => {
                    if (err || !moderationNote) {
                        progress.incr();
                        return next(err);
                    }
                    const note = {
                        uid: 1,
                        note: moderationNote,
                        timestamp: Date.now(),
                    };
                    progress.incr();
                    db.sortedSetAdd(`uid:${uid}:moderation:notes`, note.timestamp, JSON.stringify(note), next);
                });
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
