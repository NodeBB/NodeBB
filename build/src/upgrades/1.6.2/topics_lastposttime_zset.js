'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'New sorted set cid:<cid>:tids:lastposttime',
    timestamp: Date.UTC(2017, 9, 30),
    method: function (callback) {
        const { progress } = this;
        require('../../batch').processSortedSet('topics:tid', (tids, next) => {
            async.eachSeries(tids, (tid, next) => {
                database_1.default.getObjectFields(`topic:${tid}`, ['cid', 'timestamp', 'lastposttime'], (err, topicData) => {
                    if (err || !topicData) {
                        return next(err);
                    }
                    progress.incr();
                    const timestamp = topicData.lastposttime || topicData.timestamp || Date.now();
                    database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, timestamp, tid, next);
                }, next);
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
