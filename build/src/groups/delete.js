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
const plugins = require('../plugins');
const slugify = require('../slugify');
const database = __importStar(require("../database"));
const db = database;
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
                db.deleteAll(keys),
                db.sortedSetRemove([
                    'groups:createtime',
                    'groups:visible:createtime',
                    'groups:visible:memberCount',
                ], groupNames),
                db.sortedSetRemove('groups:visible:name', sets),
                db.deleteObjectFields('groupslug:groupname', fields),
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
                yield db.sortedSetRemove(keys, groupNames);
            }), {
                batch: 500,
            });
        });
    }
}
exports.default = default_1;
;
