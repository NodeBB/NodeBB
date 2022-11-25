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
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
function default_1(Groups) {
    Groups.getUsersFromSet = function (set, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const uids = yield db.getSetMembers(set);
            if (fields) {
                return yield user_1.default.getUsersFields(uids, fields);
            }
            return yield user_1.default.getUsersData(uids);
        });
    };
    Groups.getUserGroups = function (uids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Groups.getUserGroupsFromSet('groups:visible:createtime', uids);
        });
    };
    Groups.getUserGroupsFromSet = function (set, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const memberOf = yield Groups.getUserGroupMembership(set, uids);
            return yield Promise.all(memberOf.map(memberOf => Groups.getGroupsData(memberOf)));
        });
    };
    Groups.getUserGroupMembership = function (set, uids) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupNames = yield db.getSortedSetRevRange(set, 0, -1);
            return yield Promise.all(uids.map(uid => findUserGroups(uid, groupNames)));
        });
    };
    function findUserGroups(uid, groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            const isMembers = yield Groups.isMemberOfGroups(uid, groupNames);
            return groupNames.filter((name, i) => isMembers[i]);
        });
    }
    Groups.getUserInviteGroups = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            let allGroups = yield Groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
            allGroups = allGroups.filter(group => !Groups.ephemeralGroups.includes(group.name));
            const publicGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 0);
            const adminModGroups = [
                { name: 'administrators', displayName: 'administrators' },
                { name: 'Global Moderators', displayName: 'Global Moderators' },
            ];
            // Private (but not hidden)
            const privateGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 1);
            const [ownership, isAdmin, isGlobalMod] = yield Promise.all([
                Promise.all(privateGroups.map(group => Groups.ownership.isOwner(uid, group.name))),
                user_1.default.isAdministrator(uid),
                user_1.default.isGlobalModerator(uid),
            ]);
            const ownGroups = privateGroups.filter((group, index) => ownership[index]);
            let inviteGroups = [];
            if (isAdmin) {
                inviteGroups = inviteGroups.concat(adminModGroups).concat(privateGroups);
            }
            else if (isGlobalMod) {
                inviteGroups = inviteGroups.concat(privateGroups);
            }
            else {
                inviteGroups = inviteGroups.concat(ownGroups);
            }
            return inviteGroups
                .concat(publicGroups);
        });
    };
}
exports.default = default_1;
;
