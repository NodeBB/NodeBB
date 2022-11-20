'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Creating user best post sorted sets',
    timestamp: Date.UTC(2016, 0, 14),
    method: function (callback) {
        const batch = require('../../batch');
        const { progress } = this;
        batch.processSortedSet('posts:pid', (ids, next) => {
            async.eachSeries(ids, (id, next) => {
                database_1.default.getObjectFields(`post:${id}`, ['pid', 'uid', 'votes'], (err, postData) => {
                    if (err) {
                        return next(err);
                    }
                    if (!postData || !parseInt(postData.votes, 10) || !parseInt(postData.uid, 10)) {
                        return next();
                    }
                    winston_1.default.verbose(`processing pid: ${postData.pid} uid: ${postData.uid} votes: ${postData.votes}`);
                    database_1.default.sortedSetAdd(`uid:${postData.uid}:posts:votes`, postData.votes, postData.pid, next);
                    progress.incr();
                });
            }, next);
        }, {
            progress: progress,
        }, callback);
    },
};
