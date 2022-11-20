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
const validator = require('validator');
const privileges = require('../privileges');
const events = require('../events');
const groups = require('../groups');
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const notifications = require('../notifications');
const slugify = require('../slugify');
const groupsAPI = {};
groupsAPI.create = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid) {
            throw new Error('[[error:no-privileges]]');
        }
        else if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
            throw new Error('[[error:invalid-group-name]]');
        }
        const canCreate = yield privileges.global.can('group:create', caller.uid);
        if (!canCreate) {
            throw new Error('[[error:no-privileges]]');
        }
        data.ownerUid = caller.uid;
        data.system = false;
        const groupData = yield groups.create(data);
        logGroupEvent(caller, 'group-create', {
            groupName: data.name,
        });
        return groupData;
    });
};
groupsAPI.update = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
        yield isOwner(caller, groupName);
        delete data.slug;
        yield groups.update(groupName, data);
        return yield groups.getGroupData(data.name || groupName);
    });
};
groupsAPI.delete = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
        yield isOwner(caller, groupName);
        if (groups.systemGroups.includes(groupName) ||
            groups.ephemeralGroups.includes(groupName)) {
            throw new Error('[[error:not-allowed]]');
        }
        yield groups.destroy(groupName);
        logGroupEvent(caller, 'group-delete', {
            groupName: groupName,
        });
    });
};
groupsAPI.join = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        if (caller.uid <= 0 || !data.uid) {
            throw new Error('[[error:invalid-uid]]');
        }
        const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
        if (!groupName) {
            throw new Error('[[error:no-group]]');
        }
        const isCallerAdmin = yield user_1.default.isAdministrator(caller.uid);
        if (!isCallerAdmin && (groups.systemGroups.includes(groupName) ||
            groups.isPrivilegeGroup(groupName))) {
            throw new Error('[[error:not-allowed]]');
        }
        const [groupData, isCallerOwner, userExists] = yield Promise.all([
            groups.getGroupData(groupName),
            groups.ownership.isOwner(caller.uid, groupName),
            user_1.default.exists(data.uid),
        ]);
        if (!userExists) {
            throw new Error('[[error:invalid-uid]]');
        }
        const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
        if (!meta_1.default.config.allowPrivateGroups && isSelf) {
            // all groups are public!
            yield groups.join(groupName, data.uid);
            logGroupEvent(caller, 'group-join', {
                groupName: groupName,
                targetUid: data.uid,
            });
            return;
        }
        if (!isCallerAdmin && isSelf && groupData.private && groupData.disableJoinRequests) {
            throw new Error('[[error:group-join-disabled]]');
        }
        if ((!groupData.private && isSelf) || isCallerAdmin || isCallerOwner) {
            yield groups.join(groupName, data.uid);
            logGroupEvent(caller, 'group-join', {
                groupName: groupName,
                targetUid: data.uid,
            });
        }
        else if (isSelf) {
            yield groups.requestMembership(groupName, caller.uid);
            logGroupEvent(caller, 'group-request-membership', {
                groupName: groupName,
                targetUid: data.uid,
            });
        }
    });
};
groupsAPI.leave = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        if (caller.uid <= 0) {
            throw new Error('[[error:invalid-uid]]');
        }
        const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
        const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
        if (!groupName) {
            throw new Error('[[error:no-group]]');
        }
        if (typeof groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        if (groupName === 'administrators' && isSelf) {
            throw new Error('[[error:cant-remove-self-as-admin]]');
        }
        const [groupData, isCallerAdmin, isCallerOwner, userExists, isMember] = yield Promise.all([
            groups.getGroupData(groupName),
            user_1.default.isAdministrator(caller.uid),
            groups.ownership.isOwner(caller.uid, groupName),
            user_1.default.exists(data.uid),
            groups.isMember(data.uid, groupName),
        ]);
        if (!userExists) {
            throw new Error('[[error:invalid-uid]]');
        }
        if (!isMember) {
            return;
        }
        if (groupData.disableLeave && isSelf) {
            throw new Error('[[error:group-leave-disabled]]');
        }
        if (isSelf || isCallerAdmin || isCallerOwner) {
            yield groups.leave(groupName, data.uid);
        }
        else {
            throw new Error('[[error:no-privileges]]');
        }
        const { displayname } = yield user_1.default.getUserFields(data.uid, ['username']);
        const notification = yield notifications.create({
            type: 'group-leave',
            bodyShort: `[[groups:membership.leave.notification_title, ${displayname}, ${groupName}]]`,
            nid: `group:${validator.escape(groupName)}:uid:${data.uid}:group-leave`,
            path: `/groups/${slugify(groupName)}`,
            from: data.uid,
        });
        const uids = yield groups.getOwners(groupName);
        yield notifications.push(notification, uids);
        logGroupEvent(caller, 'group-leave', {
            groupName: groupName,
            targetUid: data.uid,
        });
    });
};
groupsAPI.grant = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
    yield isOwner(caller, groupName);
    yield groups.ownership.grant(data.uid, groupName);
    logGroupEvent(caller, 'group-owner-grant', {
        groupName: groupName,
        targetUid: data.uid,
    });
});
groupsAPI.rescind = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const groupName = yield groups.getGroupNameByGroupSlug(data.slug);
    yield isOwner(caller, groupName);
    yield groups.ownership.rescind(data.uid, groupName);
    logGroupEvent(caller, 'group-owner-rescind', {
        groupName: groupName,
        targetUid: data.uid,
    });
});
function isOwner(caller, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof groupName !== 'string') {
            throw new Error('[[error:invalid-group-name]]');
        }
        const [hasAdminPrivilege, isGlobalModerator, isOwner, group] = yield Promise.all([
            privileges.admin.can('admin:groups', caller.uid),
            user_1.default.isGlobalModerator(caller.uid),
            groups.ownership.isOwner(caller.uid, groupName),
            groups.getGroupData(groupName),
        ]);
        const check = isOwner || hasAdminPrivilege || (isGlobalModerator && !group.system);
        if (!check) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
function logGroupEvent(caller, event, additional) {
    events.log(Object.assign({ type: event, uid: caller.uid, ip: caller.ip }, additional));
}
exports.default = groupsAPI;
