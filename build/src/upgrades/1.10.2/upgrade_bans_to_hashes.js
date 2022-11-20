/* eslint-disable no-await-in-loop */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
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
                        database_1.default.getSortedSetRevRangeWithScores(`uid:${uid}:bans`, 0, -1),
                        database_1.default.getSortedSetRevRangeWithScores(`banned:${uid}:reasons`, 0, -1),
                        database_1.default.getObjectFields(`user:${uid}`, ['banned', 'banned:expire', 'joindate', 'lastposttime', 'lastonline']),
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
        yield database_1.default.setObject(key, data);
        yield database_1.default.sortedSetAdd(`uid:${uid}:bans:timestamp`, data.timestamp, key);
    });
}
