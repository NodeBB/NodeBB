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
const user_1 = __importDefault(require("../user"));
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const slugify = require('../slugify');
const Groups = {};
require('./data').default(Groups);
require('./create').default(Groups);
require('./delete').default(Groups);
require('./update').default(Groups);
require('./invite').default(Groups);
require('./membership').default(Groups);
require('./ownership').default(Groups);
require('./search').default(Groups);
require('./cover').default(Groups);
require('./posts').default(Groups);
require('./user').default(Groups);
require('./join').default(Groups);
require('./leave').default(Groups);
require('./cache').default(Groups);
Groups.BANNED_USERS = 'banned-users';
Groups.ephemeralGroups = ['guests', 'spiders'];
Groups.systemGroups = [
    'registered-users',
    'verified-users',
    'unverified-users',
    Groups.BANNED_USERS,
    'administrators',
    'Global Moderators',
];
Groups.getEphemeralGroup = function (groupName) {
    return {
        name: groupName,
        slug: slugify(groupName),
        description: '',
        hidden: 0,
        system: 1,
    };
};
Groups.removeEphemeralGroups = function (groups) {
    for (let x = groups.length; x >= 0; x -= 1) {
        if (Groups.ephemeralGroups.includes(groups[x])) {
            groups.splice(x, 1);
        }
    }
    return groups;
};
const isPrivilegeGroupRegex = /^cid:\d+:privileges:[\w\-:]+$/;
Groups.isPrivilegeGroup = function (groupName) {
    return isPrivilegeGroupRegex.test(groupName);
};
Groups.getGroupsFromSet = function (set, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        let groupNames;
        if (set === 'groups:visible:name') {
            groupNames = yield database_1.default.getSortedSetRangeByLex(set, '-', '+', start, stop - start + 1);
        }
        else {
            groupNames = yield database_1.default.getSortedSetRevRange(set, start, stop);
        }
        if (set === 'groups:visible:name') {
            groupNames = groupNames.map(name => name.split(':')[1]);
        }
        return yield Groups.getGroupsAndMembers(groupNames);
    });
};
Groups.getGroupsBySort = function (sort, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        let set = 'groups:visible:name';
        if (sort === 'count') {
            set = 'groups:visible:memberCount';
        }
        else if (sort === 'date') {
            set = 'groups:visible:createtime';
        }
        return yield Groups.getGroupsFromSet(set, start, stop);
    });
};
Groups.getNonPrivilegeGroups = function (set, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        let groupNames = yield database_1.default.getSortedSetRevRange(set, start, stop);
        groupNames = groupNames.concat(Groups.ephemeralGroups).filter(groupName => !Groups.isPrivilegeGroup(groupName));
        const groupsData = yield Groups.getGroupsData(groupNames);
        return groupsData.filter(Boolean);
    });
};
Groups.getGroups = function (set, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getSortedSetRevRange(set, start, stop);
    });
};
Groups.getGroupsAndMembers = function (groupNames) {
    return __awaiter(this, void 0, void 0, function* () {
        const [groups, members] = yield Promise.all([
            Groups.getGroupsData(groupNames),
            Groups.getMemberUsers(groupNames, 0, 9),
        ]);
        groups.forEach((group, index) => {
            if (group) {
                group.members = members[index] || [];
                group.truncated = group.memberCount > group.members.length;
            }
        });
        return groups;
    });
};
Groups.get = function (groupName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!groupName) {
            throw new Error('[[error:invalid-group]]');
        }
        let stop = -1;
        if (options.truncateUserList) {
            stop = (parseInt(options.userListCount, 10) || 4) - 1;
        }
        const [groupData, members, pending, invited, isMember, isPending, isInvited, isOwner] = yield Promise.all([
            Groups.getGroupData(groupName),
            Groups.getOwnersAndMembers(groupName, options.uid, 0, stop),
            Groups.getUsersFromSet(`group:${groupName}:pending`, ['username', 'userslug', 'picture']),
            Groups.getUsersFromSet(`group:${groupName}:invited`, ['username', 'userslug', 'picture']),
            Groups.isMember(options.uid, groupName),
            Groups.isPending(options.uid, groupName),
            Groups.isInvited(options.uid, groupName),
            Groups.ownership.isOwner(options.uid, groupName),
        ]);
        if (!groupData) {
            return null;
        }
        const descriptionParsed = yield plugins.hooks.fire('filter:parse.raw', String(groupData.description || ''));
        groupData.descriptionParsed = descriptionParsed;
        groupData.members = members;
        groupData.membersNextStart = stop + 1;
        groupData.pending = pending.filter(Boolean);
        groupData.invited = invited.filter(Boolean);
        groupData.isMember = isMember;
        groupData.isPending = isPending;
        groupData.isInvited = isInvited;
        groupData.isOwner = isOwner;
        const results = yield plugins.hooks.fire('filter:group.get', { group: groupData });
        return results.group;
    });
};
Groups.getOwners = function (groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getSetMembers(`group:${groupName}:owners`);
    });
};
Groups.getOwnersAndMembers = function (groupName, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        const ownerUids = yield database_1.default.getSetMembers(`group:${groupName}:owners`);
        const countToReturn = stop - start + 1;
        const ownerUidsOnPage = ownerUids.slice(start, stop !== -1 ? stop + 1 : undefined);
        const owners = yield user_1.default.getUsers(ownerUidsOnPage, uid);
        owners.forEach((user) => {
            if (user) {
                user.isOwner = true;
            }
        });
        let done = false;
        let returnUsers = owners;
        let memberStart = start - ownerUids.length;
        let memberStop = memberStart + countToReturn - 1;
        memberStart = Math.max(0, memberStart);
        memberStop = Math.max(0, memberStop);
        function addMembers(start, stop) {
            return __awaiter(this, void 0, void 0, function* () {
                let batch = yield user_1.default.getUsersFromSet(`group:${groupName}:members`, uid, start, stop);
                if (!batch.length) {
                    done = true;
                }
                batch = batch.filter(user => user && user.uid && !ownerUids.includes(user.uid.toString()));
                returnUsers = returnUsers.concat(batch);
            });
        }
        if (stop === -1) {
            yield addMembers(memberStart, -1);
        }
        else {
            while (returnUsers.length < countToReturn && !done) {
                /* eslint-disable no-await-in-loop */
                yield addMembers(memberStart, memberStop);
                memberStart = memberStop + 1;
                memberStop = memberStart + countToReturn - 1;
            }
        }
        returnUsers = countToReturn > 0 ? returnUsers.slice(0, countToReturn) : returnUsers;
        const result = yield plugins.hooks.fire('filter:group.getOwnersAndMembers', {
            users: returnUsers,
            uid: uid,
            start: start,
            stop: stop,
        });
        return result.users;
    });
};
Groups.getByGroupslug = function (slug, options) {
    return __awaiter(this, void 0, void 0, function* () {
        options = options || {};
        const groupName = yield database_1.default.getObjectField('groupslug:groupname', slug);
        if (!groupName) {
            throw new Error('[[error:no-group]]');
        }
        return yield Groups.get(groupName, options);
    });
};
Groups.getGroupNameByGroupSlug = function (slug) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield database_1.default.getObjectField('groupslug:groupname', slug);
    });
};
Groups.isPrivate = function (groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isFieldOn(groupName, 'private');
    });
};
Groups.isHidden = function (groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isFieldOn(groupName, 'hidden');
    });
};
function isFieldOn(groupName, field) {
    return __awaiter(this, void 0, void 0, function* () {
        const value = yield database_1.default.getObjectField(`group:${groupName}`, field);
        return parseInt(value, 10) === 1;
    });
}
Groups.exists = function (name) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Array.isArray(name)) {
            const slugs = name.map(groupName => slugify(groupName));
            const isMembersOfRealGroups = yield database_1.default.isSortedSetMembers('groups:createtime', name);
            const isMembersOfEphemeralGroups = slugs.map(slug => Groups.ephemeralGroups.includes(slug));
            return name.map((n, index) => isMembersOfRealGroups[index] || isMembersOfEphemeralGroups[index]);
        }
        const slug = slugify(name);
        const isMemberOfRealGroups = yield database_1.default.isSortedSetMember('groups:createtime', name);
        const isMemberOfEphemeralGroups = Groups.ephemeralGroups.includes(slug);
        return isMemberOfRealGroups || isMemberOfEphemeralGroups;
    });
};
Groups.existsBySlug = function (slug) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Array.isArray(slug)) {
            return yield database_1.default.isObjectFields('groupslug:groupname', slug);
        }
        return yield database_1.default.isObjectField('groupslug:groupname', slug);
    });
};
require('../promisify').promisify(Groups);
exports.default = Groups;
