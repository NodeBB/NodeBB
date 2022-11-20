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
const plugins = require('../plugins');
const database_1 = __importDefault(require("../database"));
function default_1(User) {
    User.follow = function (uid, followuid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield toggleFollow('follow', uid, followuid);
        });
    };
    User.unfollow = function (uid, unfollowuid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield toggleFollow('unfollow', uid, unfollowuid);
        });
    };
    function toggleFollow(type, uid, theiruid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0 || parseInt(theiruid, 10) <= 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
                throw new Error('[[error:you-cant-follow-yourself]]');
            }
            const exists = yield User.exists(theiruid);
            if (!exists) {
                throw new Error('[[error:no-user]]');
            }
            const isFollowing = yield User.isFollowing(uid, theiruid);
            if (type === 'follow') {
                if (isFollowing) {
                    throw new Error('[[error:already-following]]');
                }
                const now = Date.now();
                yield Promise.all([
                    database_1.default.sortedSetAddBulk([
                        [`following:${uid}`, now, theiruid],
                        [`followers:${theiruid}`, now, uid],
                    ]),
                ]);
            }
            else {
                if (!isFollowing) {
                    throw new Error('[[error:not-following]]');
                }
                yield Promise.all([
                    database_1.default.sortedSetRemoveBulk([
                        [`following:${uid}`, theiruid],
                        [`followers:${theiruid}`, uid],
                    ]),
                ]);
            }
            const [followingCount, followerCount] = yield Promise.all([
                database_1.default.sortedSetCard(`following:${uid}`),
                database_1.default.sortedSetCard(`followers:${theiruid}`),
            ]);
            yield Promise.all([
                User.setUserField(uid, 'followingCount', followingCount),
                User.setUserField(theiruid, 'followerCount', followerCount),
            ]);
        });
    }
    User.getFollowing = function (uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getFollow(uid, 'following', start, stop);
        });
    };
    User.getFollowers = function (uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield getFollow(uid, 'followers', start, stop);
        });
    };
    function getFollow(uid, type, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return [];
            }
            const uids = yield database_1.default.getSortedSetRevRange(`${type}:${uid}`, start, stop);
            const data = yield plugins.hooks.fire(`filter:user.${type}`, {
                uids: uids,
                uid: uid,
                start: start,
                stop: stop,
            });
            return yield User.getUsers(data.uids, uid);
        });
    }
    User.isFollowing = function (uid, theirid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0 || parseInt(theirid, 10) <= 0) {
                return false;
            }
            return yield database_1.default.isSortedSetMember(`following:${uid}`, theirid);
        });
    };
}
exports.default = default_1;
;
