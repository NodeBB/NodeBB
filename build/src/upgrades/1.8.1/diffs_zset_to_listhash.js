'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Reformatting post diffs to be stored in lists and hash instead of single zset',
    timestamp: Date.UTC(2018, 2, 15),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('posts:pid', (pids, next) => {
            async.each(pids, (pid, next) => {
                database_1.default.getSortedSetRangeWithScores(`post:${pid}:diffs`, 0, -1, (err, diffs) => {
                    if (err) {
                        return next(err);
                    }
                    if (!diffs || !diffs.length) {
                        progress.incr();
                        return next();
                    }
                    // For each diff, push to list
                    async.each(diffs, (diff, next) => {
                        async.series([
                            async.apply(database_1.default.delete.bind(database_1.default), `post:${pid}:diffs`),
                            async.apply(database_1.default.listPrepend.bind(database_1.default), `post:${pid}:diffs`, diff.score),
                            async.apply(database_1.default.setObject.bind(database_1.default), `diff:${pid}.${diff.score}`, {
                                pid: pid,
                                patch: diff.value,
                            }),
                        ], next);
                    }, (err) => {
                        if (err) {
                            return next(err);
                        }
                        progress.incr();
                        return next();
                    });
                });
            }, (err) => {
                if (err) {
                    // Probably type error, ok to incr and continue
                    progress.incr();
                }
                return next();
            });
        }, {
            progress: progress,
        }, callback);
    },
};
