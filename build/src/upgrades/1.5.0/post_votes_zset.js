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
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'New sorted set posts:votes',
    timestamp: Date.UTC(2017, 1, 27),
    method: function (callback) {
        const { progress } = this;
        require('../../batch').processSortedSet('posts:pid', (pids, next) => {
            async.each(pids, (pid, next) => {
                db.getObjectFields(`post:${pid}`, ['upvotes', 'downvotes'], (err, postData) => {
                    if (err || !postData) {
                        return next(err);
                    }
                    progress.incr();
                    const votes = parseInt(postData.upvotes || 0, 10) - parseInt(postData.downvotes || 0, 10);
                    db.sortedSetAdd('posts:votes', votes, pid, next);
                });
            }, next);
        }, {
            progress: this.progress,
        }, callback);
    },
};
