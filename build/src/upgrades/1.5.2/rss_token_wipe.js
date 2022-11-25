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
const batch = require('../../batch');
const database = __importStar(require("../../database"));
const db = database;
exports.default = {
    name: 'Wipe all existing RSS tokens',
    timestamp: Date.UTC(2017, 6, 5),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('users:joindate', (uids, next) => {
            async.eachLimit(uids, 500, (uid, next) => {
                progress.incr();
                db.deleteObjectField(`user:${uid}`, 'rss_token', next);
            }, next);
        }, {
            progress: progress,
        }, callback);
    },
};
