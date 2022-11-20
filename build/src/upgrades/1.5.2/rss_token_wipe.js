'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const batch = require('../../batch');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Wipe all existing RSS tokens',
    timestamp: Date.UTC(2017, 6, 5),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('users:joindate', (uids, next) => {
            async.eachLimit(uids, 500, (uid, next) => {
                progress.incr();
                database_1.default.deleteObjectField(`user:${uid}`, 'rss_token', next);
            }, next);
        }, {
            progress: progress,
        }, callback);
    },
};
