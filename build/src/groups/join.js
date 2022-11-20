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
const winston_1 = __importDefault(require("winston"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const cache = require('../cache');
function default_1(Groups) {
    Groups.join = function (groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupNames) {
                throw new Error('[[error:invalid-data]]');
            }
            if (Array.isArray(groupNames) && !groupNames.length) {
                return;
            }
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            if (!uid) {
                throw new Error('[[error:invalid-uid]]');
            }
            const [isMembers, exists, isAdmin] = yield Promise.all([
                Groups.isMemberOfGroups(uid, groupNames),
                Groups.exists(groupNames),
                user_1.default.isAdministrator(uid),
            ]);
            const groupsToCreate = groupNames.filter((groupName, index) => groupName && !exists[index]);
            const groupsToJoin = groupNames.filter((groupName, index) => !isMembers[index]);
            if (!groupsToJoin.length) {
                return;
            }
            yield createNonExistingGroups(groupsToCreate);
            const promises = [
                database_1.default.sortedSetsAdd(groupsToJoin.map(groupName => `group:${groupName}:members`), Date.now(), uid),
                database_1.default.incrObjectField(groupsToJoin.map(groupName => `group:${groupName}`), 'memberCount'),
            ];
            if (isAdmin) {
                promises.push(database_1.default.setsAdd(groupsToJoin.map(groupName => `group:${groupName}:owners`), uid));
            }
            yield Promise.all(promises);
            Groups.clearCache(uid, groupsToJoin);
            cache.del(groupsToJoin.map(name => `group:${name}:members`));
            const groupData = yield Groups.getGroupsFields(groupsToJoin, ['name', 'hidden', 'memberCount']);
            const visibleGroups = groupData.filter(groupData => groupData && !groupData.hidden);
            if (visibleGroups.length) {
                yield database_1.default.sortedSetAdd('groups:visible:memberCount', visibleGroups.map(groupData => groupData.memberCount), visibleGroups.map(groupData => groupData.name));
            }
            yield setGroupTitleIfNotSet(groupsToJoin, uid);
            plugins.hooks.fire('action:group.join', {
                groupNames: groupsToJoin,
                uid: uid,
            });
        });
    };
    function createNonExistingGroups(groupsToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupsToCreate.length) {
                return;
            }
            for (const groupName of groupsToCreate) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    yield Groups.create({
                        name: groupName,
                        hidden: 1,
                    });
                }
                catch (err) {
                    if (err && err.message !== '[[error:group-already-exists]]') {
                        winston_1.default.error(`[groups.join] Could not create new hidden group (${groupName})\n${err.stack}`);
                        throw err;
                    }
                }
            }
        });
    }
    function setGroupTitleIfNotSet(groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const ignore = ['registered-users', 'verified-users', 'unverified-users', Groups.BANNED_USERS];
            groupNames = groupNames.filter(groupName => !ignore.includes(groupName) && !Groups.isPrivilegeGroup(groupName));
            if (!groupNames.length) {
                return;
            }
            const currentTitle = yield database_1.default.getObjectField(`user:${uid}`, 'groupTitle');
            if (currentTitle || currentTitle === '') {
                return;
            }
            yield user_1.default.setUserField(uid, 'groupTitle', JSON.stringify(groupNames));
        });
    }
}
exports.default = default_1;
;
