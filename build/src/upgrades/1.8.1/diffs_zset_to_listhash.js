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
const batch = require('../../batch');
exports.default = {
    name: 'Reformatting post diffs to be stored in lists and hash instead of single zset',
    timestamp: Date.UTC(2018, 2, 15),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('posts:pid', (pids, next) => {
            async.each(pids, (pid, next) => {
                db.getSortedSetRangeWithScores(`post:${pid}:diffs`, 0, -1, (err, diffs) => {
                    if (err) {
                        return next(err);
                    }
                    if (!diffs || !diffs.length) {
                        progress.incr();
                        return next();
                    }
                    // For each diff, push to list
                    async.each(diffs, (diff, next) => {
                        async.series([
                            async.apply(db.delete.bind(db), `post:${pid}:diffs`),
                            async.apply(db.listPrepend.bind(db), `post:${pid}:diffs`, diff.score),
                            async.apply(db.setObject.bind(db), `diff:${pid}.${diff.score}`, {
                                pid: pid,
                                patch: diff.value,
                            }),
                        ], next);
                    }, (err) => {
                        if (err) {
                            return next(err);
                        }
                        progress.incr();
                        return next();
                    });
                });
            }, (err) => {
                if (err) {
                    // Probably type error, ok to incr and continue
                    progress.incr();
                }
                return next();
            });
        }, {
            progress: progress,
        }, callback);
    },
};
