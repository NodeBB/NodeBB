'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const crypto = require('crypto');
const nconf_1 = __importDefault(require("nconf"));
const batch = require('../../batch');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Hash all IP addresses stored in Recent IPs zset',
    timestamp: Date.UTC(2018, 5, 22),
    method: function (callback) {
        const { progress } = this;
        const hashed = /[a-f0-9]{32}/;
        let hash;
        batch.processSortedSet('ip:recent', (ips, next) => {
            async.each(ips, (set, next) => {
                // Short circuit if already processed
                if (hashed.test(set.value)) {
                    progress.incr();
                    return setImmediate(next);
                }
                hash = crypto.createHash('sha1').update(set.value + nconf_1.default.get('secret')).digest('hex');
                async.series([
                    async.apply(database_1.default.sortedSetAdd, 'ip:recent', set.score, hash),
                    async.apply(database_1.default.sortedSetRemove, 'ip:recent', set.value),
                ], (err) => {
                    progress.incr();
                    next(err);
                });
            }, next);
        }, {
            withScores: 1,
            progress: this.progress,
        }, callback);
    },
};
