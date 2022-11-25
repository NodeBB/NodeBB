'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const crypto = require('crypto');
const nconf_1 = __importDefault(require("nconf"));
const batch = require('../../batch');
const database = __importStar(require("../../database"));
const db = database;
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
                    async.apply(db.sortedSetAdd, 'ip:recent', set.score, hash),
                    async.apply(db.sortedSetRemove, 'ip:recent', set.value),
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
