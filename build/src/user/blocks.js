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
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const cacheCreate = require('../cache/lru').default;
function default_1(User) {
    User.blocks = {
        _cache: cacheCreate({
            name: 'user:blocks',
            max: 100,
            ttl: 0,
        }),
    };
    User.blocks.is = function (targetUid, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(uids);
            uids = isArray ? uids : [uids];
            const blocks = yield User.blocks.list(uids);
            const isBlocked = uids.map((uid, index) => blocks[index] && blocks[index].includes(parseInt(targetUid, 10)));
            return isArray ? isBlocked : isBlocked[0];
        });
    };
    User.blocks.can = function (callerUid, blockerUid, blockeeUid, type) {
        return __awaiter(this, void 0, void 0, function* () {
            // Guests can't block
            if (blockerUid === 0 || blockeeUid === 0) {
                throw new Error('[[error:cannot-block-guest]]');
            }
            else if (blockerUid === blockeeUid) {
                throw new Error('[[error:cannot-block-self]]');
            }
            // Administrators and global moderators cannot be blocked
            // Only admins/mods can block users as another user
            const [isCallerAdminOrMod, isBlockeeAdminOrMod] = yield Promise.all([
                User.isAdminOrGlobalMod(callerUid),
                User.isAdminOrGlobalMod(blockeeUid),
            ]);
            if (isBlockeeAdminOrMod && type === 'block') {
                throw new Error('[[error:cannot-block-privileged]]');
            }
            if (parseInt(callerUid, 10) !== parseInt(blockerUid, 10) && !isCallerAdminOrMod) {
                throw new Error('[[error:no-privileges]]');
            }
        });
    };
    User.blocks.list = function (uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(uids);
            uids = (isArray ? uids : [uids]).map(uid => parseInt(uid, 10));
            const cachedData = {};
            const unCachedUids = User.blocks._cache.getUnCachedKeys(uids, cachedData);
            if (unCachedUids.length) {
                const unCachedData = yield database_1.default.getSortedSetsMembers(unCachedUids.map(uid => `uid:${uid}:blocked_uids`));
                unCachedUids.forEach((uid, index) => {
                    cachedData[uid] = (unCachedData[index] || []).map(uid => parseInt(uid, 10));
                    User.blocks._cache.set(uid, cachedData[uid]);
                });
            }
            const result = uids.map(uid => cachedData[uid] || []);
            return isArray ? result.slice() : result[0];
        });
    };
    User.blocks.add = function (targetUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.blocks.applyChecks('block', targetUid, uid);
            yield database_1.default.sortedSetAdd(`uid:${uid}:blocked_uids`, Date.now(), targetUid);
            yield User.incrementUserFieldBy(uid, 'blocksCount', 1);
            User.blocks._cache.del(parseInt(uid, 10));
            plugins.hooks.fire('action:user.blocks.add', { uid: uid, targetUid: targetUid });
        });
    };
    User.blocks.remove = function (targetUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.blocks.applyChecks('unblock', targetUid, uid);
            yield database_1.default.sortedSetRemove(`uid:${uid}:blocked_uids`, targetUid);
            yield User.decrementUserFieldBy(uid, 'blocksCount', 1);
            User.blocks._cache.del(parseInt(uid, 10));
            plugins.hooks.fire('action:user.blocks.remove', { uid: uid, targetUid: targetUid });
        });
    };
    User.blocks.applyChecks = function (type, targetUid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield User.blocks.can(uid, uid, targetUid);
            const isBlock = type === 'block';
            const is = yield User.blocks.is(targetUid, uid);
            if (is === isBlock) {
                throw new Error(`[[error:already-${isBlock ? 'blocked' : 'unblocked'}]]`);
            }
        });
    };
    User.blocks.filterUids = function (targetUid, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isBlocked = yield User.blocks.is(targetUid, uids);
            return uids.filter((uid, index) => !isBlocked[index]);
        });
    };
    User.blocks.filter = function (uid, property, set) {
        return __awaiter(this, void 0, void 0, function* () {
            // Given whatever is passed in, iterates through it, and removes entries made by blocked uids
            // property is optional
            if (Array.isArray(property) && typeof set === 'undefined') {
                set = property;
                property = 'uid';
            }
            if (!Array.isArray(set) || !set.length) {
                return set;
            }
            const isPlain = typeof set[0] !== 'object';
            const blocked_uids = yield User.blocks.list(uid);
            const blockedSet = new Set(blocked_uids);
            set = set.filter((item) => !blockedSet.has(parseInt(isPlain ? item : (item && item[property]), 10)));
            const data = yield plugins.hooks.fire('filter:user.blocks.filter', { set: set, property: property, uid: uid, blockedSet: blockedSet });
            return data.set;
        });
    };
}
exports.default = default_1;
;
