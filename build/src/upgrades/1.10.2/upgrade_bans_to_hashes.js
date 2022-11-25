/* eslint-disable no-await-in-loop */
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
exports.default = {
    name: 'Upgrade bans to hashes',
    timestamp: Date.UTC(2018, 8, 24),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                for (const uid of uids) {
                    progress.incr();
                    const [bans, reasons, userData] = yield Promise.all([
                        db.getSortedSetRevRangeWithScores(`uid:${uid}:bans`, 0, -1),
                        db.getSortedSetRevRangeWithScores(`banned:${uid}:reasons`, 0, -1),
                        db.getObjectFields(`user:${uid}`, ['banned', 'banned:expire', 'joindate', 'lastposttime', 'lastonline']),
                    ]);
                    // has no history, but is banned, create plain object with just uid and timestmap
                    if (!bans.length && parseInt(userData.banned, 10)) {
                        const banTimestamp = (userData.lastonline ||
                            userData.lastposttime ||
                            userData.joindate ||
                            Date.now());
                        const banKey = `uid:${uid}:ban:${banTimestamp}`;
                        yield addBan(uid, banKey, { uid: uid, timestamp: banTimestamp });
                    }
                    else if (bans.length) {
                        // process ban history
                        for (const ban of bans) {
                            const reasonData = reasons.find(reasonData => reasonData.score === ban.score);
                            const banKey = `uid:${uid}:ban:${ban.score}`;
                            const data = {
                                uid: uid,
                                timestamp: ban.score,
                                expire: parseInt(ban.value, 10),
                            };
                            if (reasonData) {
                                data.reason = reasonData.value;
                            }
                            yield addBan(uid, banKey, data);
                        }
                    }
                }
            }), {
                progress: this.progress,
            });
        });
    },
};
function addBan(uid, key, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.setObject(key, data);
        yield db.sortedSetAdd(`uid:${uid}:bans:timestamp`, data.timestamp, key);
    });
}
