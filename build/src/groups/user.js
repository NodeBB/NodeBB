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
function default_1(Groups) {
    Groups.getUsersFromSet = function (set, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const uids = yield database_1.default.getSetMembers(set);
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
            const groupNames = yield database_1.default.getSortedSetRevRange(set, 0, -1);
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
