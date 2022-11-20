'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Sorted set for pinned topics',
    timestamp: Date.UTC(2016, 10, 25),
    method: function (callback) {
        const topics = require('../../topics');
        const batch = require('../../batch');
        batch.processSortedSet('topics:tid', (ids, next) => {
            topics.getTopicsFields(ids, ['tid', 'cid', 'pinned', 'lastposttime'], (err, data) => {
                if (err) {
                    return next(err);
                }
                data = data.filter(topicData => parseInt(topicData.pinned, 10) === 1);
                async.eachSeries(data, (topicData, next) => {
                    winston_1.default.verbose(`processing tid: ${topicData.tid}`);
                    async.parallel([
                        async.apply(database_1.default.sortedSetAdd, `cid:${topicData.cid}:tids:pinned`, Date.now(), topicData.tid),
                        async.apply(database_1.default.sortedSetRemove, `cid:${topicData.cid}:tids`, topicData.tid),
                        async.apply(database_1.default.sortedSetRemove, `cid:${topicData.cid}:tids:posts`, topicData.tid),
                    ], next);
                }, next);
            });
        }, callback);
    },
};
