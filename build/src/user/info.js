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
const _ = require('lodash');
const validator = require('validator');
const database_1 = __importDefault(require("../database"));
const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');
function default_1(User) {
    User.getLatestBanInfo = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            // Simply retrieves the last record of the user's ban, even if they've been unbanned since then.
            const record = yield database_1.default.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0);
            if (!record.length) {
                throw new Error('no-ban-info');
            }
            const banInfo = yield database_1.default.getObject(record[0]);
            const expire = parseInt(banInfo.expire, 10);
            const expire_readable = utils.toISOString(expire);
            return {
                uid: uid,
                timestamp: banInfo.timestamp,
                banned_until: expire,
                expiry: expire,
                banned_until_readable: expire_readable,
                expiry_readable: expire_readable,
                reason: validator.escape(String(banInfo.reason || '')),
            };
        });
    };
    User.getModerationHistory = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let [flags, bans, mutes] = yield Promise.all([
                database_1.default.getSortedSetRevRangeWithScores(`flags:byTargetUid:${uid}`, 0, 19),
                database_1.default.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 19),
                database_1.default.getSortedSetRevRange(`uid:${uid}:mutes:timestamp`, 0, 19),
            ]);
            // Get pids from flag objects
            const keys = flags.map(flagObj => `flag:${flagObj.value}`);
            const payload = yield database_1.default.getObjectsFields(keys, ['type', 'targetId']);
            // Only pass on flag ids from posts
            flags = payload.reduce((memo, cur, idx) => {
                if (cur.type === 'post') {
                    memo.push({
                        value: parseInt(cur.targetId, 10),
                        score: flags[idx].score,
                    });
                }
                return memo;
            }, []);
            [flags, bans, mutes] = yield Promise.all([
                getFlagMetadata(flags),
                formatBanMuteData(bans, '[[user:info.banned-no-reason]]'),
                formatBanMuteData(mutes, '[[user:info.muted-no-reason]]'),
            ]);
            return {
                flags: flags,
                bans: bans,
                mutes: mutes,
            };
        });
    };
    User.getHistory = function (set) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getSortedSetRevRangeWithScores(set, 0, -1);
            return data.map((set) => {
                set.timestamp = set.score;
                set.timestampISO = utils.toISOString(set.score);
                set.value = validator.escape(String(set.value.split(':')[0]));
                delete set.score;
                return set;
            });
        });
    };
    function getFlagMetadata(flags) {
        return __awaiter(this, void 0, void 0, function* () {
            const pids = flags.map(flagObj => parseInt(flagObj.value, 10));
            const postData = yield posts.getPostsFields(pids, ['tid']);
            const tids = postData.map(post => post.tid);
            const topicData = yield topics.getTopicsFields(tids, ['title']);
            flags = flags.map((flagObj, idx) => {
                flagObj.pid = flagObj.value;
                flagObj.timestamp = flagObj.score;
                flagObj.timestampISO = new Date(flagObj.score).toISOString();
                flagObj.timestampReadable = new Date(flagObj.score).toString();
                delete flagObj.value;
                delete flagObj.score;
                if (!tids[idx]) {
                    flagObj.targetPurged = true;
                }
                return _.extend(flagObj, topicData[idx]);
            });
            return flags;
        });
    }
    function formatBanMuteData(keys, noReasonLangKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getObjects(keys);
            const uids = data.map((d) => d.fromUid);
            const usersData = yield User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
            return data.map((banObj, index) => {
                banObj.user = usersData[index];
                banObj.until = parseInt(banObj.expire, 10);
                banObj.untilReadable = new Date(banObj.until).toString();
                banObj.timestampReadable = new Date(parseInt(banObj.timestamp, 10)).toString();
                banObj.timestampISO = utils.toISOString(banObj.timestamp);
                banObj.reason = validator.escape(String(banObj.reason || '')) || noReasonLangKey;
                return banObj;
            });
        });
    }
    User.getModerationNotes = function (uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            const noteIds = yield database_1.default.getSortedSetRevRange(`uid:${uid}:moderation:notes`, start, stop);
            const keys = noteIds.map(id => `uid:${uid}:moderation:note:${id}`);
            const notes = yield database_1.default.getObjects(keys);
            const uids = [];
            const noteData = notes.map((note) => {
                if (note) {
                    uids.push(note.uid);
                    note.timestampISO = utils.toISOString(note.timestamp);
                    note.note = validator.escape(String(note.note));
                }
                return note;
            });
            const userData = yield User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
            noteData.forEach((note, index) => {
                if (note) {
                    note.user = userData[index];
                }
            });
            return noteData;
        });
    };
    User.appendModerationNote = ({ uid, noteData }) => __awaiter(this, void 0, void 0, function* () {
        yield database_1.default.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
        yield database_1.default.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
    });
}
exports.default = default_1;
;
