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
const user_1 = __importDefault(require("../user"));
const database = __importStar(require("../database"));
const db = database;
function default_1(Groups) {
    Groups.search = function (query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query) {
                return [];
            }
            query = String(query).toLowerCase();
            let groupNames = yield db.getSortedSetRange('groups:createtime', 0, -1);
            if (!options.hideEphemeralGroups) {
                groupNames = Groups.ephemeralGroups.concat(groupNames);
            }
            groupNames = groupNames.filter(name => name.toLowerCase().includes(query) &&
                name !== Groups.BANNED_USERS && // hide banned-users in searches
                !Groups.isPrivilegeGroup(name));
            groupNames = groupNames.slice(0, 100);
            let groupsData;
            if (options.showMembers) {
                groupsData = yield Groups.getGroupsAndMembers(groupNames);
            }
            else {
                groupsData = yield Groups.getGroupsData(groupNames);
            }
            groupsData = groupsData.filter(Boolean);
            if (options.filterHidden) {
                groupsData = groupsData.filter(group => !group.hidden);
            }
            return Groups.sort(options.sort, groupsData);
        });
    };
    Groups.sort = function (strategy, groups) {
        switch (strategy) {
            case 'count':
                groups.sort((a, b) => a.slug > b.slug)
                    .sort((a, b) => b.memberCount - a.memberCount);
                break;
            case 'date':
                groups.sort((a, b) => b.createtime - a.createtime);
                break;
            case 'alpha': // intentional fall-through
            default:
                groups.sort((a, b) => (a.slug > b.slug ? 1 : -1));
        }
        return groups;
    };
    Groups.searchMembers = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.query) {
                const users = yield Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19);
                return { users: users };
            }
            const results = yield user_1.default.search(Object.assign(Object.assign({}, data), { paginate: false, hardCap: -1 }));
            const uids = results.users.map(user => user && user.uid);
            const isOwners = yield Groups.ownership.isOwners(uids, data.groupName);
            results.users.forEach((user, index) => {
                if (user) {
                    user.isOwner = isOwners[index];
                }
            });
            results.users.sort((a, b) => {
                if (a.isOwner && !b.isOwner) {
                    return -1;
                }
                else if (!a.isOwner && b.isOwner) {
                    return 1;
                }
                return 0;
            });
            return results;
        });
    };
}
exports.default = default_1;
;
