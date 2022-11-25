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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../database"));
const db = database;
const meta_1 = __importDefault(require("../meta"));
const privileges = require('../privileges');
function default_1(User) {
    User.isReadyToPost = function (uid, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield isReady(uid, cid, 'lastposttime');
        });
    };
    User.isReadyToQueue = function (uid, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield isReady(uid, cid, 'lastqueuetime');
        });
    };
    function isReady(uid, cid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) === 0) {
                return;
            }
            const [userData, isAdminOrMod] = yield Promise.all([
                User.getUserFields(uid, ['uid', 'mutedUntil', 'joindate', 'email', 'reputation'].concat([field])),
                privileges.categories.isAdminOrMod(cid, uid),
            ]);
            if (!userData.uid) {
                throw new Error('[[error:no-user]]');
            }
            if (isAdminOrMod) {
                return;
            }
            const now = Date.now();
            if (userData.mutedUntil > now) {
                let muteLeft = ((userData.mutedUntil - now) / (1000 * 60));
                if (muteLeft > 60) {
                    muteLeft = (muteLeft / 60).toFixed(0);
                    throw new Error(`[[error:user-muted-for-hours, ${muteLeft}]]`);
                }
                else {
                    throw new Error(`[[error:user-muted-for-minutes, ${muteLeft.toFixed(0)}]]`);
                }
            }
            if (now - userData.joindate < meta_1.default.config.initialPostDelay * 1000) {
                throw new Error(`[[error:user-too-new, ${meta_1.default.config.initialPostDelay}]]`);
            }
            const lasttime = userData[field] || 0;
            if (meta_1.default.config.newbiePostDelay > 0 &&
                meta_1.default.config.newbiePostDelayThreshold > userData.reputation &&
                now - lasttime < meta_1.default.config.newbiePostDelay * 1000) {
                throw new Error(`[[error:too-many-posts-newbie, ${meta_1.default.config.newbiePostDelay}, ${meta_1.default.config.newbiePostDelayThreshold}]]`);
            }
            else if (now - lasttime < meta_1.default.config.postDelay * 1000) {
                throw new Error(`[[error:too-many-posts, ${meta_1.default.config.postDelay}]]`);
            }
        });
    }
    User.onNewPostMade = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            // For scheduled posts, use "action" time. It'll be updated in related cron job when post is published
            const lastposttime = postData.timestamp > Date.now() ? Date.now() : postData.timestamp;
            yield Promise.all([
                User.addPostIdToUser(postData),
                User.setUserField(postData.uid, 'lastposttime', lastposttime),
                User.updateLastOnlineTime(postData.uid),
            ]);
        });
    };
    User.addPostIdToUser = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.sortedSetsAdd([
                `uid:${postData.uid}:posts`,
                `cid:${postData.cid}:uid:${postData.uid}:pids`,
            ], postData.timestamp, postData.pid);
            yield User.updatePostCount(postData.uid);
        });
    };
    User.updatePostCount = (uids) => __awaiter(this, void 0, void 0, function* () {
        uids = Array.isArray(uids) ? uids : [uids];
        const exists = yield User.exists(uids);
        uids = uids.filter((uid, index) => exists[index]);
        if (uids.length) {
            const counts = yield db.sortedSetsCard(uids.map(uid => `uid:${uid}:posts`));
            yield Promise.all([
                db.setObjectBulk(uids.map((uid, index) => ([`user:${uid}`, { postcount: counts[index] }]))),
                db.sortedSetAdd('users:postcount', counts, uids),
            ]);
        }
    });
    User.incrementUserPostCountBy = function (uid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield incrementUserFieldAndSetBy(uid, 'postcount', 'users:postcount', value);
        });
    };
    User.incrementUserReputationBy = function (uid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield incrementUserFieldAndSetBy(uid, 'reputation', 'users:reputation', value);
        });
    };
    User.incrementUserFlagsBy = function (uid, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield incrementUserFieldAndSetBy(uid, 'flags', 'users:flags', value);
        });
    };
    function incrementUserFieldAndSetBy(uid, field, set, value) {
        return __awaiter(this, void 0, void 0, function* () {
            value = parseInt(value, 10);
            if (!value || !field || !(parseInt(uid, 10) > 0)) {
                return;
            }
            const exists = yield User.exists(uid);
            if (!exists) {
                return;
            }
            const newValue = yield User.incrementUserFieldBy(uid, field, value);
            yield db.sortedSetAdd(set, newValue, uid);
            return newValue;
        });
    }
    User.getPostIds = function (uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield db.getSortedSetRevRange(`uid:${uid}:posts`, start, stop);
        });
    };
}
exports.default = default_1;
;
