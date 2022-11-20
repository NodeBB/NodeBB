'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../../database"));
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Group title from settings to user profile',
    timestamp: Date.UTC(2016, 3, 14),
    method: function (callback) {
        const batch = require('../../batch');
        let count = 0;
        batch.processSortedSet('users:joindate', (uids, next) => {
            winston_1.default.verbose(`upgraded ${count} users`);
            user_1.default.getMultipleUserSettings(uids, (err, settings) => {
                if (err) {
                    return next(err);
                }
                count += uids.length;
                settings = settings.filter(setting => setting && setting.groupTitle);
                async.each(settings, (setting, next) => {
                    database_1.default.setObjectField(`user:${setting.uid}`, 'groupTitle', setting.groupTitle, next);
                }, next);
            });
        }, {}, callback);
    },
};
