'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const privileges = require('../../privileges');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Give post history viewing privilege to registered-users on all categories',
    timestamp: Date.UTC(2018, 5, 7),
    method: function (callback) {
        database_1.default.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(cids, (cid, next) => {
                privileges.categories.give(['groups:posts:history'], cid, 'registered-users', next);
            }, callback);
        });
    },
};
