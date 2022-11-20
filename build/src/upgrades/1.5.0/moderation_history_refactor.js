'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Update moderation notes to zset',
    timestamp: Date.UTC(2017, 2, 22),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('users:joindate', (ids, next) => {
            async.each(ids, (uid, next) => {
                database_1.default.getObjectField(`user:${uid}`, 'moderationNote', (err, moderationNote) => {
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
                    database_1.default.sortedSetAdd(`uid:${uid}:moderation:notes`, note.timestamp, JSON.stringify(note), next);
                });
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
