'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Category recent tids',
    timestamp: Date.UTC(2016, 8, 22),
    method: function (callback) {
        database_1.default.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(cids, (cid, next) => {
                database_1.default.getSortedSetRevRange(`cid:${cid}:pids`, 0, 0, (err, pid) => {
                    if (err || !pid) {
                        return next(err);
                    }
                    database_1.default.getObjectFields(`post:${pid}`, ['tid', 'timestamp'], (err, postData) => {
                        if (err || !postData || !postData.tid) {
                            return next(err);
                        }
                        database_1.default.sortedSetAdd(`cid:${cid}:recent_tids`, postData.timestamp, postData.tid, next);
                    });
                });
            }, callback);
        });
    },
};
