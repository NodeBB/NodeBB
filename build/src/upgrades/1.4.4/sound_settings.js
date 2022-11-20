'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require('async');
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Update global and user sound settings',
    timestamp: Date.UTC(2017, 1, 25),
    method: function (callback) {
        const batch = require('../../batch');
        const map = {
            'notification.mp3': 'Default | Deedle-dum',
            'waterdrop-high.mp3': 'Default | Water drop (high)',
            'waterdrop-low.mp3': 'Default | Water drop (low)',
        };
        async.parallel([
            function (cb) {
                const keys = ['chat-incoming', 'chat-outgoing', 'notification'];
                database_1.default.getObject('settings:sounds', (err, settings) => {
                    if (err || !settings) {
                        return cb(err);
                    }
                    keys.forEach((key) => {
                        if (settings[key] && !settings[key].includes(' | ')) {
                            settings[key] = map[settings[key]] || '';
                        }
                    });
                    meta_1.default.configs.setMultiple(settings, cb);
                });
            },
            function (cb) {
                const keys = ['notificationSound', 'incomingChatSound', 'outgoingChatSound'];
                batch.processSortedSet('users:joindate', (ids, next) => {
                    async.each(ids, (uid, next) => {
                        database_1.default.getObject(`user:${uid}:settings`, (err, settings) => {
                            if (err || !settings) {
                                return next(err);
                            }
                            const newSettings = {};
                            keys.forEach((key) => {
                                if (settings[key] && !settings[key].includes(' | ')) {
                                    newSettings[key] = map[settings[key]] || '';
                                }
                            });
                            if (Object.keys(newSettings).length) {
                                database_1.default.setObject(`user:${uid}:settings`, newSettings, next);
                            }
                            else {
                                setImmediate(next);
                            }
                        });
                    }, next);
                }, cb);
            },
        ], callback);
    },
};
