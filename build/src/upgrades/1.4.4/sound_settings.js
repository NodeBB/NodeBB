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
const database = __importStar(require("../../database"));
const db = database;
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
                db.getObject('settings:sounds', (err, settings) => {
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
                        db.getObject(`user:${uid}:settings`, (err, settings) => {
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
                                db.setObject(`user:${uid}:settings`, newSettings, next);
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
