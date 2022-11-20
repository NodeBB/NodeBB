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
const slugify = require('../slugify');
const database_1 = __importDefault(require("../database"));
const batch = require('../batch');
function default_1(Groups) {
    Groups.destroy = function (groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            let groupsData = yield Groups.getGroupsData(groupNames);
            groupsData = groupsData.filter(Boolean);
            if (!groupsData.length) {
                return;
            }
            const keys = [];
            groupNames.forEach((groupName) => {
                keys.push(`group:${groupName}`, `group:${groupName}:members`, `group:${groupName}:pending`, `group:${groupName}:invited`, `group:${groupName}:owners`, `group:${groupName}:member:pids`);
            });
            const sets = groupNames.map(groupName => `${groupName.toLowerCase()}:${groupName}`);
            const fields = groupNames.map(groupName => slugify(groupName));
            yield Promise.all([
                database_1.default.deleteAll(keys),
                database_1.default.sortedSetRemove([
                    'groups:createtime',
                    'groups:visible:createtime',
                    'groups:visible:memberCount',
                ], groupNames),
                database_1.default.sortedSetRemove('groups:visible:name', sets),
                database_1.default.deleteObjectFields('groupslug:groupname', fields),
                removeGroupsFromPrivilegeGroups(groupNames),
            ]);
            Groups.cache.reset();
            plugins.hooks.fire('action:groups.destroy', { groups: groupsData });
        });
    };
    function removeGroupsFromPrivilegeGroups(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet('groups:createtime', (otherGroups) => __awaiter(this, void 0, void 0, function* () {
                const privilegeGroups = otherGroups.filter(group => Groups.isPrivilegeGroup(group));
                const keys = privilegeGroups.map(group => `group:${group}:members`);
                yield database_1.default.sortedSetRemove(keys, groupNames);
            }), {
                batch: 500,
            });
        });
    }
}
exports.default = default_1;
;
