'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'New sorted set posts:votes',
    timestamp: Date.UTC(2017, 1, 27),
    method: function (callback) {
        const { progress } = this;
        require('../../batch').processSortedSet('posts:pid', (pids, next) => {
            async.each(pids, (pid, next) => {
                database_1.default.getObjectFields(`post:${pid}`, ['upvotes', 'downvotes'], (err, postData) => {
                    if (err || !postData) {
                        return next(err);
                    }
                    progress.incr();
                    const votes = parseInt(postData.upvotes || 0, 10) - parseInt(postData.downvotes || 0, 10);
                    database_1.default.sortedSetAdd('posts:votes', votes, pid, next);
                });
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
