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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const cache = require('../cache');
function default_1(Groups) {
    Groups.getMembers = function (groupName, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSortedSetRevRange(`group:${groupName}:members`, start, stop);
        });
    };
    Groups.getMemberUsers = function (groupNames, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            function get(groupName) {
                return __awaiter(this, void 0, void 0, function* () {
                    const uids = yield Groups.getMembers(groupName, start, stop);
                    return yield user_1.default.getUsersFields(uids, ['uid', 'username', 'picture', 'userslug']);
                });
            }
            return yield Promise.all(groupNames.map(name => get(name)));
        });
    };
    Groups.getMembersOfGroups = function (groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getSortedSetsMembers(groupNames.map(name => `group:${name}:members`));
        });
    };
    Groups.isMember = function (uid, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uid || parseInt(uid, 10) <= 0 || !groupName) {
                return false;
            }
            const cacheKey = `${uid}:${groupName}`;
            let isMember = Groups.cache.get(cacheKey);
            if (isMember !== undefined) {
                return isMember;
            }
            isMember = yield database_1.default.isSortedSetMember(`group:${groupName}:members`, uid);
            Groups.cache.set(cacheKey, isMember);
            return isMember;
        });
    };
    Groups.isMembers = function (uids, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupName || !uids.length) {
                return uids.map(() => false);
            }
            if (groupName === 'guests') {
                return uids.map(uid => parseInt(uid, 10) === 0);
            }
            const cachedData = {};
            const nonCachedUids = uids.filter(uid => filterNonCached(cachedData, uid, groupName));
            if (!nonCachedUids.length) {
                return uids.map(uid => cachedData[`${uid}:${groupName}`]);
            }
            const isMembers = yield database_1.default.isSortedSetMembers(`group:${groupName}:members`, nonCachedUids);
            nonCachedUids.forEach((uid, index) => {
                cachedData[`${uid}:${groupName}`] = isMembers[index];
                Groups.cache.set(`${uid}:${groupName}`, isMembers[index]);
            });
            return uids.map(uid => cachedData[`${uid}:${groupName}`]);
        });
    };
    Groups.isMemberOfGroups = function (uid, groups) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
                return groups.map(groupName => groupName === 'guests');
            }
            const cachedData = {};
            const nonCachedGroups = groups.filter(groupName => filterNonCached(cachedData, uid, groupName));
            if (!nonCachedGroups.length) {
                return groups.map(groupName => cachedData[`${uid}:${groupName}`]);
            }
            const nonCachedGroupsMemberSets = nonCachedGroups.map(groupName => `group:${groupName}:members`);
            const isMembers = yield database_1.default.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid);
            nonCachedGroups.forEach((groupName, index) => {
                cachedData[`${uid}:${groupName}`] = isMembers[index];
                Groups.cache.set(`${uid}:${groupName}`, isMembers[index]);
            });
            return groups.map(groupName => cachedData[`${uid}:${groupName}`]);
        });
    };
    function filterNonCached(cachedData, uid, groupName) {
        const isMember = Groups.cache.get(`${uid}:${groupName}`);
        const isInCache = isMember !== undefined;
        if (isInCache) {
            cachedData[`${uid}:${groupName}`] = isMember;
        }
        return !isInCache;
    }
    Groups.isMemberOfAny = function (uid, groups) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groups.length) {
                return false;
            }
            const isMembers = yield Groups.isMemberOfGroups(uid, groups);
            return isMembers.includes(true);
        });
    };
    Groups.getMemberCount = function (groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield database_1.default.getObjectField(`group:${groupName}`, 'memberCount');
            return parseInt(count, 10);
        });
    };
    Groups.isMemberOfGroupList = function (uid, groupListKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let groupNames = yield getGroupNames(groupListKey);
            groupNames = Groups.removeEphemeralGroups(groupNames);
            if (!groupNames.length) {
                return false;
            }
            const isMembers = yield Groups.isMemberOfGroups(uid, groupNames);
            return isMembers.includes(true);
        });
    };
    Groups.isMemberOfGroupsList = function (uid, groupListKeys) {
        return __awaiter(this, void 0, void 0, function* () {
            const members = yield getGroupNames(groupListKeys);
            let uniqueGroups = _.uniq(_.flatten(members));
            uniqueGroups = Groups.removeEphemeralGroups(uniqueGroups);
            const isMembers = yield Groups.isMemberOfGroups(uid, uniqueGroups);
            const isGroupMember = _.zipObject(uniqueGroups, isMembers);
            return members.map(groupNames => !!groupNames.find(name => isGroupMember[name]));
        });
    };
    Groups.isMembersOfGroupList = function (uids, groupListKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = uids.map(() => false);
            let groupNames = yield getGroupNames(groupListKey);
            groupNames = Groups.removeEphemeralGroups(groupNames);
            if (!groupNames.length) {
                return results;
            }
            const isGroupMembers = yield Promise.all(groupNames.map(name => Groups.isMembers(uids, name)));
            isGroupMembers.forEach((isMembers) => {
                results.forEach((isMember, index) => {
                    if (!isMember && isMembers[index]) {
                        results[index] = true;
                    }
                });
            });
            return results;
        });
    };
    function getGroupNames(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(keys);
            keys = isArray ? keys : [keys];
            const cachedData = {};
            const nonCachedKeys = keys.filter((groupName) => {
                const groupMembers = cache.get(`group:${groupName}:members`);
                const isInCache = groupMembers !== undefined;
                if (isInCache) {
                    cachedData[groupName] = groupMembers;
                }
                return !isInCache;
            });
            if (!nonCachedKeys.length) {
                return isArray ? keys.map(groupName => cachedData[groupName]) : cachedData[keys[0]];
            }
            const groupMembers = yield database_1.default.getSortedSetsMembers(nonCachedKeys.map(name => `group:${name}:members`));
            nonCachedKeys.forEach((groupName, index) => {
                cachedData[groupName] = groupMembers[index];
                cache.set(`group:${groupName}:members`, groupMembers[index]);
            });
            return isArray ? keys.map(groupName => cachedData[groupName]) : cachedData[keys[0]];
        });
    }
}
exports.default = default_1;
;
