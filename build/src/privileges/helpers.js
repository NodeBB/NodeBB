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
const groups = require('../groups');
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const translator = require('../translator');
const helpers = {};
const uidToSystemGroup = {
    0: 'guests',
    '-1': 'spiders',
};
helpers.isUsersAllowedTo = function (privilege, uids, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [hasUserPrivilege, hasGroupPrivilege] = yield Promise.all([
            groups.isMembers(uids, `cid:${cid}:privileges:${privilege}`),
            groups.isMembersOfGroupList(uids, `cid:${cid}:privileges:groups:${privilege}`),
        ]);
        const allowed = uids.map((uid, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
        const result = yield plugins.hooks.fire('filter:privileges:isUsersAllowedTo', { allowed: allowed, privilege: privilege, uids: uids, cid: cid });
        return result.allowed;
    });
};
helpers.isAllowedTo = function (privilege, uidOrGroupName, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        let allowed;
        if (Array.isArray(privilege) && !Array.isArray(cid)) {
            allowed = yield isAllowedToPrivileges(privilege, uidOrGroupName, cid);
        }
        else if (Array.isArray(cid) && !Array.isArray(privilege)) {
            allowed = yield isAllowedToCids(privilege, uidOrGroupName, cid);
        }
        if (allowed) {
            ({ allowed } = yield plugins.hooks.fire('filter:privileges:isAllowedTo', { allowed: allowed, privilege: privilege, uid: uidOrGroupName, cid: cid }));
            return allowed;
        }
        throw new Error('[[error:invalid-data]]');
    });
};
function isAllowedToCids(privilege, uidOrGroupName, cids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!privilege) {
            return cids.map(() => false);
        }
        const groupKeys = cids.map((cid) => `cid:${cid}:privileges:groups:${privilege}`);
        // Group handling
        if (isNaN(parseInt(uidOrGroupName, 10)) && (uidOrGroupName || '').length) {
            return yield checkIfAllowedGroup(uidOrGroupName, groupKeys);
        }
        // User handling
        if (parseInt(uidOrGroupName, 10) <= 0) {
            return yield isSystemGroupAllowedToCids(privilege, uidOrGroupName, cids);
        }
        const userKeys = cids.map((cid) => `cid:${cid}:privileges:${privilege}`);
        return yield checkIfAllowedUser(uidOrGroupName, userKeys, groupKeys);
    });
}
function isAllowedToPrivileges(privileges, uidOrGroupName, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupKeys = privileges.map(privilege => `cid:${cid}:privileges:groups:${privilege}`);
        // Group handling
        if (isNaN(parseInt(uidOrGroupName, 10)) && (uidOrGroupName || '').length) {
            return yield checkIfAllowedGroup(uidOrGroupName, groupKeys);
        }
        // User handling
        if (parseInt(uidOrGroupName, 10) <= 0) {
            return yield isSystemGroupAllowedToPrivileges(privileges, uidOrGroupName, cid);
        }
        const userKeys = privileges.map(privilege => `cid:${cid}:privileges:${privilege}`);
        return yield checkIfAllowedUser(uidOrGroupName, userKeys, groupKeys);
    });
}
function checkIfAllowedUser(uid, userKeys, groupKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        const [hasUserPrivilege, hasGroupPrivilege] = yield Promise.all([
            groups.isMemberOfGroups(uid, userKeys),
            groups.isMemberOfGroupsList(uid, groupKeys),
        ]);
        return userKeys.map((key, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
    });
}
function checkIfAllowedGroup(groupName, groupKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        const sets = yield Promise.all([
            groups.isMemberOfGroups(groupName, groupKeys),
            groups.isMemberOfGroups('registered-users', groupKeys),
        ]);
        return groupKeys.map((key, index) => sets[0][index] || sets[1][index]);
    });
}
function isSystemGroupAllowedToCids(privilege, uid, cids) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupKeys = cids.map((cid) => `cid:${cid}:privileges:groups:${privilege}`);
        return yield groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
    });
}
function isSystemGroupAllowedToPrivileges(privileges, uid, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupKeys = privileges.map(privilege => `cid:${cid}:privileges:groups:${privilege}`);
        return yield groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
    });
}
helpers.getUserPrivileges = function (cid, userPrivileges) {
    return __awaiter(this, void 0, void 0, function* () {
        let memberSets = yield groups.getMembersOfGroups(userPrivileges.map(privilege => `cid:${cid}:privileges:${privilege}`));
        memberSets = memberSets.map(set => set.map(uid => parseInt(uid, 10)));
        const members = _.uniq(_.flatten(memberSets));
        const memberData = yield user_1.default.getUsersFields(members, ['picture', 'username', 'banned']);
        memberData.forEach((member) => {
            member.privileges = {};
            for (let x = 0, numPrivs = userPrivileges.length; x < numPrivs; x += 1) {
                member.privileges[userPrivileges[x]] = memberSets[x].includes(parseInt(member.uid, 10));
            }
        });
        return memberData;
    });
};
helpers.getGroupPrivileges = function (cid, groupPrivileges) {
    return __awaiter(this, void 0, void 0, function* () {
        const [memberSets, allGroupNames] = yield Promise.all([
            groups.getMembersOfGroups(groupPrivileges.map(privilege => `cid:${cid}:privileges:${privilege}`)),
            groups.getGroups('groups:createtime', 0, -1),
        ]);
        const uniqueGroups = _.uniq(_.flatten(memberSets));
        let groupNames = allGroupNames.filter(groupName => !groupName.includes(':privileges:') && uniqueGroups.includes(groupName));
        groupNames = groups.ephemeralGroups.concat(groupNames);
        moveToFront(groupNames, groups.BANNED_USERS);
        moveToFront(groupNames, 'Global Moderators');
        moveToFront(groupNames, 'unverified-users');
        moveToFront(groupNames, 'verified-users');
        moveToFront(groupNames, 'registered-users');
        const adminIndex = groupNames.indexOf('administrators');
        if (adminIndex !== -1) {
            groupNames.splice(adminIndex, 1);
        }
        const groupData = yield groups.getGroupsFields(groupNames, ['private', 'system']);
        const memberData = groupNames.map((member, index) => {
            const memberPrivs = {};
            for (let x = 0, numPrivs = groupPrivileges.length; x < numPrivs; x += 1) {
                memberPrivs[groupPrivileges[x]] = memberSets[x].includes(member);
            }
            return {
                name: validator.escape(member),
                nameEscaped: translator.escape(validator.escape(member)),
                privileges: memberPrivs,
                isPrivate: groupData[index] && !!groupData[index].private,
                isSystem: groupData[index] && !!groupData[index].system,
            };
        });
        return memberData;
    });
};
function moveToFront(groupNames, groupToMove) {
    const index = groupNames.indexOf(groupToMove);
    if (index !== -1) {
        groupNames.splice(0, 0, groupNames.splice(index, 1)[0]);
    }
    else {
        groupNames.unshift(groupToMove);
    }
}
helpers.giveOrRescind = function (method, privileges, cids, members) {
    return __awaiter(this, void 0, void 0, function* () {
        members = Array.isArray(members) ? members : [members];
        cids = Array.isArray(cids) ? cids : [cids];
        for (const member of members) {
            const groupKeys = [];
            cids.forEach((cid) => {
                privileges.forEach((privilege) => {
                    groupKeys.push(`cid:${cid}:privileges:${privilege}`);
                });
            });
            /* eslint-disable no-await-in-loop */
            yield method(groupKeys, member);
        }
    });
};
helpers.userOrGroupPrivileges = function (cid, uidOrGroup, privilegeList) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupNames = privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`);
        const isMembers = yield groups.isMemberOfGroups(uidOrGroup, groupNames);
        return _.zipObject(privilegeList, isMembers);
    });
};
require('../promisify').promisify(helpers);
exports.default = helpers;
