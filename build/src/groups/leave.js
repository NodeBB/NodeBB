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
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const cache = require('../cache');
function default_1(Groups) {
    Groups.leave = function (groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(groupNames) && !groupNames.length) {
                return;
            }
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            const isMembers = yield Groups.isMemberOfGroups(uid, groupNames);
            const groupsToLeave = groupNames.filter((groupName, index) => isMembers[index]);
            if (!groupsToLeave.length) {
                return;
            }
            yield Promise.all([
                database_1.default.sortedSetRemove(groupsToLeave.map(groupName => `group:${groupName}:members`), uid),
                database_1.default.setRemove(groupsToLeave.map(groupName => `group:${groupName}:owners`), uid),
                database_1.default.decrObjectField(groupsToLeave.map(groupName => `group:${groupName}`), 'memberCount'),
            ]);
            Groups.clearCache(uid, groupsToLeave);
            cache.del(groupsToLeave.map(name => `group:${name}:members`));
            const groupData = yield Groups.getGroupsFields(groupsToLeave, ['name', 'hidden', 'memberCount']);
            if (!groupData) {
                return;
            }
            const emptyPrivilegeGroups = groupData.filter(g => g && Groups.isPrivilegeGroup(g.name) && g.memberCount === 0);
            const visibleGroups = groupData.filter(g => g && !g.hidden);
            const promises = [];
            if (emptyPrivilegeGroups.length) {
                promises.push(Groups.destroy, emptyPrivilegeGroups);
            }
            if (visibleGroups.length) {
                promises.push(database_1.default.sortedSetAdd, 'groups:visible:memberCount', visibleGroups.map(groupData => groupData.memberCount), visibleGroups.map(groupData => groupData.name));
            }
            yield Promise.all(promises);
            yield clearGroupTitleIfSet(groupsToLeave, uid);
            plugins.hooks.fire('action:group.leave', {
                groupNames: groupsToLeave,
                uid: uid,
            });
        });
    };
    function clearGroupTitleIfSet(groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            groupNames = groupNames.filter(groupName => groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName));
            if (!groupNames.length) {
                return;
            }
            const userData = yield user_1.default.getUserData(uid);
            if (!userData) {
                return;
            }
            const newTitleArray = userData.groupTitleArray.filter(groupTitle => !groupNames.includes(groupTitle));
            if (newTitleArray.length) {
                yield database_1.default.setObjectField(`user:${uid}`, 'groupTitle', JSON.stringify(newTitleArray));
            }
            else {
                yield database_1.default.deleteObjectField(`user:${uid}`, 'groupTitle');
            }
        });
    }
    Groups.leaveAllGroups = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const groups = yield database_1.default.getSortedSetRange('groups:createtime', 0, -1);
            yield Promise.all([
                Groups.leave(groups, uid),
                Groups.rejectMembership(groups, uid),
            ]);
        });
    };
    Groups.kick = function (uid, groupName, isOwner) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isOwner) {
                // If the owners set only contains one member, error out!
                const numOwners = yield database_1.default.setCount(`group:${groupName}:owners`);
                if (numOwners <= 1) {
                    throw new Error('[[error:group-needs-owner]]');
                }
            }
            yield Groups.leave(groupName, uid);
        });
    };
}
exports.default = default_1;
;
