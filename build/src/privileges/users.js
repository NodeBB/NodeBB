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
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const groups_1 = __importDefault(require("../groups"));
const plugins_1 = __importDefault(require("../plugins"));
const helpers_1 = __importDefault(require("./helpers"));
const privsUsers = {};
privsUsers.isAdministrator = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isGroupMember(uid, 'administrators');
    });
};
privsUsers.isGlobalModerator = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield isGroupMember(uid, 'Global Moderators');
    });
};
function isGroupMember(uid, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield groups_1.default[Array.isArray(uid) ? 'isMembers' : 'isMember'](uid, groupName);
    });
}
privsUsers.isModerator = function (uid, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Array.isArray(cid)) {
            return yield isModeratorOfCategories(cid, uid);
        }
        else if (Array.isArray(uid)) {
            return yield isModeratorsOfCategory(cid, uid);
        }
        return yield isModeratorOfCategory(cid, uid);
    });
};
function isModeratorOfCategories(cids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return yield filterIsModerator(cids, uid, cids.map(() => false));
        }
        const isGlobalModerator = yield privsUsers.isGlobalModerator(uid);
        if (isGlobalModerator) {
            return yield filterIsModerator(cids, uid, cids.map(() => true));
        }
        const uniqueCids = _.uniq(cids);
        const isAllowed = yield helpers_1.default.isAllowedTo('moderate', uid, uniqueCids);
        const cidToIsAllowed = _.zipObject(uniqueCids, isAllowed);
        const isModerator = cids.map((cid) => cidToIsAllowed[cid]);
        return yield filterIsModerator(cids, uid, isModerator);
    });
}
function isModeratorsOfCategory(cid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        const [check1, check2, check3] = yield Promise.all([
            privsUsers.isGlobalModerator(uids),
            groups_1.default.isMembers(uids, `cid:${cid}:privileges:moderate`),
            groups_1.default.isMembersOfGroupList(uids, `cid:${cid}:privileges:groups:moderate`),
        ]);
        const isModerator = uids.map((uid, idx) => check1[idx] || check2[idx] || check3[idx]);
        return yield filterIsModerator(cid, uids, isModerator);
    });
}
function isModeratorOfCategory(cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield isModeratorOfCategories([cid], uid);
        return result ? result[0] : false;
    });
}
function filterIsModerator(cid, uid, isModerator) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield plugins_1.default.hooks.fire('filter:user.isModerator', { uid: uid, cid: cid, isModerator: isModerator });
        if ((Array.isArray(uid) || Array.isArray(cid)) && !Array.isArray(data.isModerator)) {
            throw new Error('filter:user.isModerator - i/o mismatch');
        }
        return data.isModerator;
    });
}
privsUsers.canEdit = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
            return true;
        }
        const [isAdmin, isGlobalMod, isTargetAdmin] = yield Promise.all([
            privsUsers.isAdministrator(callerUid),
            privsUsers.isGlobalModerator(callerUid),
            privsUsers.isAdministrator(uid),
        ]);
        const data = yield plugins_1.default.hooks.fire('filter:user.canEdit', {
            isAdmin: isAdmin,
            isGlobalMod: isGlobalMod,
            isTargetAdmin: isTargetAdmin,
            canEdit: isAdmin || (isGlobalMod && !isTargetAdmin),
            callerUid: callerUid,
            uid: uid,
        });
        return data.canEdit;
    });
};
privsUsers.canBanUser = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privsGlobal = require('./global');
        const [canBan, isTargetAdmin] = yield Promise.all([
            privsGlobal.can('ban', callerUid),
            privsUsers.isAdministrator(uid),
        ]);
        const data = yield plugins_1.default.hooks.fire('filter:user.canBanUser', {
            canBan: canBan && !isTargetAdmin,
            callerUid: callerUid,
            uid: uid,
        });
        return data.canBan;
    });
};
privsUsers.canMuteUser = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privsGlobal = require('./global');
        const [canMute, isTargetAdmin] = yield Promise.all([
            privsGlobal.can('mute', callerUid),
            privsUsers.isAdministrator(uid),
        ]);
        const data = yield plugins_1.default.hooks.fire('filter:user.canMuteUser', {
            canMute: canMute && !isTargetAdmin,
            callerUid: callerUid,
            uid: uid,
        });
        return data.canMute;
    });
};
privsUsers.canFlag = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userReputation, targetPrivileged, reporterPrivileged] = yield Promise.all([
            user_1.default.getUserField(callerUid, 'reputation'),
            user_1.default.isPrivileged(uid),
            user_1.default.isPrivileged(callerUid),
        ]);
        const minimumReputation = meta_1.default.config['min:rep:flag'];
        let canFlag = reporterPrivileged || (userReputation >= minimumReputation);
        if (targetPrivileged && !reporterPrivileged) {
            canFlag = false;
        }
        return { flag: canFlag };
    });
};
privsUsers.hasBanPrivilege = (uid) => __awaiter(void 0, void 0, void 0, function* () { return yield hasGlobalPrivilege('ban', uid); });
privsUsers.hasMutePrivilege = (uid) => __awaiter(void 0, void 0, void 0, function* () { return yield hasGlobalPrivilege('mute', uid); });
privsUsers.hasInvitePrivilege = (uid) => __awaiter(void 0, void 0, void 0, function* () { return yield hasGlobalPrivilege('invite', uid); });
function hasGlobalPrivilege(privilege, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privsGlobal = require('./global');
        const privilegeName = privilege.split('-').map(word => word.slice(0, 1).toUpperCase() + word.slice(1)).join('');
        let payload = { uid };
        payload[`can${privilegeName}`] = yield privsGlobal.can(privilege, uid);
        payload = yield plugins_1.default.hooks.fire(`filter:user.has${privilegeName}Privilege`, payload);
        return payload[`can${privilegeName}`];
    });
}
exports.default = privsUsers;
