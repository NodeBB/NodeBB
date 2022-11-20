'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
exports.default = {
    name: 'Remove uid:<uid>:ignored:cids',
    timestamp: Date.UTC(2018, 11, 11),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('users:joindate', (uids, next) => {
            progress.incr(uids.length);
            const keys = uids.map(uid => `uid:${uid}:ignored:cids`);
            database_1.default.deleteAll(keys, next);
        }, {
            progress: this.progress,
            batch: 500,
        }, callback);
    },
};
