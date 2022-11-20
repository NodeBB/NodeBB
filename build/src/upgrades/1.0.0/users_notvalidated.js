'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Creating users:notvalidated',
    timestamp: Date.UTC(2016, 0, 20),
    method: function (callback) {
        const batch = require('../../batch');
        const now = Date.now();
        batch.processSortedSet('users:joindate', (ids, next) => {
            async.eachSeries(ids, (id, next) => {
                database_1.default.getObjectFields(`user:${id}`, ['uid', 'email:confirmed'], (err, userData) => {
                    if (err) {
                        return next(err);
                    }
                    if (!userData || !parseInt(userData.uid, 10) || parseInt(userData['email:confirmed'], 10) === 1) {
                        return next();
                    }
                    winston_1.default.verbose(`processing uid: ${userData.uid} email:confirmed: ${userData['email:confirmed']}`);
                    database_1.default.sortedSetAdd('users:notvalidated', now, userData.uid, next);
                });
            }, next);
        }, callback);
    },
};
