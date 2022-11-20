'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Sorted sets for post replies',
    timestamp: Date.UTC(2016, 9, 14),
    method: function (callback) {
        const posts = require('../../posts');
        const batch = require('../../batch');
        const { progress } = this;
        batch.processSortedSet('posts:pid', (ids, next) => {
            posts.getPostsFields(ids, ['pid', 'toPid', 'timestamp'], (err, data) => {
                if (err) {
                    return next(err);
                }
                progress.incr();
                async.eachSeries(data, (postData, next) => {
                    if (!parseInt(postData.toPid, 10)) {
                        return next(null);
                    }
                    winston_1.default.verbose(`processing pid: ${postData.pid} toPid: ${postData.toPid}`);
                    async.parallel([
                        async.apply(database_1.default.sortedSetAdd, `pid:${postData.toPid}:replies`, postData.timestamp, postData.pid),
                        async.apply(database_1.default.incrObjectField, `post:${postData.toPid}`, 'replies'),
                    ], next);
                }, next);
            });
        }, {
            progress: progress,
        }, callback);
    },
};
