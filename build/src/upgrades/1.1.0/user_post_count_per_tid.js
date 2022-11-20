'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Users post count per tid',
    timestamp: Date.UTC(2016, 3, 19),
    method: function (callback) {
        const batch = require('../../batch');
        const topics = require('../../topics');
        let count = 0;
        batch.processSortedSet('topics:tid', (tids, next) => {
            winston_1.default.verbose(`upgraded ${count} topics`);
            count += tids.length;
            async.each(tids, (tid, next) => {
                database_1.default.delete(`tid:${tid}:posters`, (err) => {
                    if (err) {
                        return next(err);
                    }
                    topics.getPids(tid, (err, pids) => {
                        if (err) {
                            return next(err);
                        }
                        if (!pids.length) {
                            return next();
                        }
                        async.eachSeries(pids, (pid, next) => {
                            database_1.default.getObjectField(`post:${pid}`, 'uid', (err, uid) => {
                                if (err) {
                                    return next(err);
                                }
                                if (!parseInt(uid, 10)) {
                                    return next();
                                }
                                database_1.default.sortedSetIncrBy(`tid:${tid}:posters`, 1, uid, next);
                            });
                        }, next);
                    });
                });
            }, next);
        }, {}, callback);
    },
};
