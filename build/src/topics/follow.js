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
const database = __importStar(require("../database"));
const db = database;
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');
function default_1(Topics) {
    Topics.toggleFollow = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield Topics.exists(tid);
            if (!exists) {
                throw new Error('[[error:no-topic]]');
            }
            const isFollowing = yield Topics.isFollowing([tid], uid);
            if (isFollowing[0]) {
                yield Topics.unfollow(tid, uid);
            }
            else {
                yield Topics.follow(tid, uid);
            }
            return !isFollowing[0];
        });
    };
    Topics.follow = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield setWatching(follow, unignore, 'action:topic.follow', tid, uid);
        });
    };
    Topics.unfollow = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield setWatching(unfollow, unignore, 'action:topic.unfollow', tid, uid);
        });
    };
    Topics.ignore = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield setWatching(ignore, unfollow, 'action:topic.ignore', tid, uid);
        });
    };
    function setWatching(method1, method2, hook, tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                throw new Error('[[error:not-logged-in]]');
            }
            const exists = yield Topics.exists(tid);
            if (!exists) {
                throw new Error('[[error:no-topic]]');
            }
            yield method1(tid, uid);
            yield method2(tid, uid);
            plugins.hooks.fire(hook, { uid: uid, tid: tid });
        });
    }
    function follow(tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield addToSets(`tid:${tid}:followers`, `uid:${uid}:followed_tids`, tid, uid);
        });
    }
    function unfollow(tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeFromSets(`tid:${tid}:followers`, `uid:${uid}:followed_tids`, tid, uid);
        });
    }
    function ignore(tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield addToSets(`tid:${tid}:ignorers`, `uid:${uid}:ignored_tids`, tid, uid);
        });
    }
    function unignore(tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeFromSets(`tid:${tid}:ignorers`, `uid:${uid}:ignored_tids`, tid, uid);
        });
    }
    function addToSets(set1, set2, tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setAdd(set1, uid);
            yield db.sortedSetAdd(set2, Date.now(), tid);
        });
    }
    function removeFromSets(set1, set2, tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setRemove(set1, uid);
            yield db.sortedSetRemove(set2, tid);
        });
    }
    Topics.isFollowing = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield isIgnoringOrFollowing('followers', tids, uid);
        });
    };
    Topics.isIgnoring = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield isIgnoringOrFollowing('ignorers', tids, uid);
        });
    };
    Topics.getFollowData = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids)) {
                return;
            }
            if (parseInt(uid, 10) <= 0) {
                return tids.map(() => ({ following: false, ignoring: false }));
            }
            const keys = [];
            tids.forEach(tid => keys.push(`tid:${tid}:followers`, `tid:${tid}:ignorers`));
            const data = yield db.isMemberOfSets(keys, uid);
            const followData = [];
            for (let i = 0; i < data.length; i += 2) {
                followData.push({
                    following: data[i],
                    ignoring: data[i + 1],
                });
            }
            return followData;
        });
    };
    function isIgnoringOrFollowing(set, tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids)) {
                return;
            }
            if (parseInt(uid, 10) <= 0) {
                return tids.map(() => false);
            }
            const keys = tids.map(tid => `tid:${tid}:${set}`);
            return yield db.isMemberOfSets(keys, uid);
        });
    }
    Topics.getFollowers = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield db.getSetMembers(`tid:${tid}:followers`);
        });
    };
    Topics.getIgnorers = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield db.getSetMembers(`tid:${tid}:ignorers`);
        });
    };
    Topics.filterIgnoringUids = function (tid, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isIgnoring = yield db.isSetMembers(`tid:${tid}:ignorers`, uids);
            const readingUids = uids.filter((uid, index) => uid && !isIgnoring[index]);
            return readingUids;
        });
    };
    Topics.filterWatchedTids = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return [];
            }
            const scores = yield db.sortedSetScores(`uid:${uid}:followed_tids`, tids);
            return tids.filter((tid, index) => tid && !!scores[index]);
        });
    };
    Topics.filterNotIgnoredTids = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return tids;
            }
            const scores = yield db.sortedSetScores(`uid:${uid}:ignored_tids`, tids);
            return tids.filter((tid, index) => tid && !scores[index]);
        });
    };
    Topics.notifyFollowers = function (postData, exceptUid, notifData) {
        return __awaiter(this, void 0, void 0, function* () {
            notifData = notifData || {};
            let followers = yield Topics.getFollowers(postData.topic.tid);
            const index = followers.indexOf(String(exceptUid));
            if (index !== -1) {
                followers.splice(index, 1);
            }
            followers = yield privileges.topics.filterUids('topics:read', postData.topic.tid, followers);
            if (!followers.length) {
                return;
            }
            let { title } = postData.topic;
            if (title) {
                title = utils.decodeHTMLEntities(title);
            }
            const notification = yield notifications.create(Object.assign({ subject: title, bodyLong: postData.content, pid: postData.pid, path: `/post/${postData.pid}`, tid: postData.topic.tid, from: exceptUid, topicTitle: title }, notifData));
            notifications.push(notification, followers);
        });
    };
}
exports.default = default_1;
;
