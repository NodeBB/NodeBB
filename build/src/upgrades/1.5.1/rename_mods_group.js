'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const batch = require('../../batch');
const groups = require('../../groups');
exports.default = {
    name: 'rename user mod privileges group',
    timestamp: Date.UTC(2017, 4, 26),
    method: function (callback) {
        const { progress } = this;
        batch.processSortedSet('categories:cid', (cids, next) => {
            async.eachSeries(cids, (cid, next) => {
                const groupName = `cid:${cid}:privileges:mods`;
                const newName = `cid:${cid}:privileges:moderate`;
                groups.exists(groupName, (err, exists) => {
                    if (err || !exists) {
                        progress.incr();
                        return next(err);
                    }
                    winston_1.default.verbose(`renaming ${groupName} to ${newName}`);
                    progress.incr();
                    groups.renameGroup(groupName, newName, next);
                });
            }, next);
        }, {
            progress: progress,
        }, callback);
    },
};
