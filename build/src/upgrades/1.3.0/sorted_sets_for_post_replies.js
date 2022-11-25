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
const winston_1 = __importDefault(require("winston"));
const database = __importStar(require("../../database"));
const db = database;
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
                        async.apply(db.sortedSetAdd, `pid:${postData.toPid}:replies`, postData.timestamp, postData.pid),
                        async.apply(db.incrObjectField, `post:${postData.toPid}`, 'replies'),
                    ], next);
                }, next);
            });
        }, {
            progress: progress,
        }, callback);
    },
};
