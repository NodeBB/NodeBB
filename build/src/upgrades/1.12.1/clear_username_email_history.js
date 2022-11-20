'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Delete username email history for deleted users',
    timestamp: Date.UTC(2019, 2, 25),
    method: function (callback) {
        const { progress } = this;
        let currentUid = 1;
        database_1.default.getObjectField('global', 'nextUid', (err, nextUid) => {
            if (err) {
                return callback(err);
            }
            progress.total = nextUid;
            async.whilst((next) => {
                next(null, currentUid < nextUid);
            }, (next) => {
                progress.incr();
                user_1.default.exists(currentUid, (err, exists) => {
                    if (err) {
                        return next(err);
                    }
                    if (exists) {
                        currentUid += 1;
                        return next();
                    }
                    database_1.default.deleteAll([`user:${currentUid}:usernames`, `user:${currentUid}:emails`], (err) => {
                        if (err) {
                            return next(err);
                        }
                        currentUid += 1;
                        next();
                    });
                });
            }, (err) => {
                callback(err);
            });
        });
    },
};
