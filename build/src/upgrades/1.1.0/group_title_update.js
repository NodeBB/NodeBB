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
                    db.setObjectField(`user:${setting.uid}`, 'groupTitle', setting.groupTitle, next);
                }, next);
            });
        }, {}, callback);
    },
};
