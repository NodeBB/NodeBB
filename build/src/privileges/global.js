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
const groups = require('../groups');
const helpers = require('./helpers').defualt;
const plugins = require('../plugins');
const utils = require('../utils');
const privsGlobal = {};
/**
 * Looking to add a new global privilege via plugin/theme? Attach a hook to
 * `static:privileges.global.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
    ['chat', { label: '[[admin/manage/privileges:chat]]' }],
    ['upload:post:image', { label: '[[admin/manage/privileges:upload-images]]' }],
    ['upload:post:file', { label: '[[admin/manage/privileges:upload-files]]' }],
    ['signature', { label: '[[admin/manage/privileges:signature]]' }],
    ['invite', { label: '[[admin/manage/privileges:invite]]' }],
    ['group:create', { label: '[[admin/manage/privileges:allow-group-creation]]' }],
    ['search:content', { label: '[[admin/manage/privileges:search-content]]' }],
    ['search:users', { label: '[[admin/manage/privileges:search-users]]' }],
    ['search:tags', { label: '[[admin/manage/privileges:search-tags]]' }],
    ['view:users', { label: '[[admin/manage/privileges:view-users]]' }],
    ['view:tags', { label: '[[admin/manage/privileges:view-tags]]' }],
    ['view:groups', { label: '[[admin/manage/privileges:view-groups]]' }],
    ['local:login', { label: '[[admin/manage/privileges:allow-local-login]]' }],
    ['ban', { label: '[[admin/manage/privileges:ban]]' }],
    ['mute', { label: '[[admin/manage/privileges:mute]]' }],
    ['view:users:info', { label: '[[admin/manage/privileges:view-users-info]]' }],
]);
privsGlobal.getUserPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.global.list', Array.from(_privilegeMap.keys())); });
privsGlobal.getGroupPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.global.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`)); });
privsGlobal.getPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () {
    const [user, group] = yield Promise.all([
        privsGlobal.getUserPrivilegeList(),
        privsGlobal.getGroupPrivilegeList(),
    ]);
    return user.concat(group);
});
privsGlobal.init = () => __awaiter(void 0, void 0, void 0, function* () {
    privsGlobal._coreSize = _privilegeMap.size;
    yield plugins.hooks.fire('static:privileges.global.init', {
        privileges: _privilegeMap,
    });
});
privsGlobal.list = function () {
    return __awaiter(this, void 0, void 0, function* () {
        function getLabels() {
            return __awaiter(this, void 0, void 0, function* () {
                const labels = Array.from(_privilegeMap.values()).map(data => data.label);
                return yield utils.promiseParallel({
                    users: plugins.hooks.fire('filter:privileges.global.list_human', labels.slice()),
                    groups: plugins.hooks.fire('filter:privileges.global.groups.list_human', labels.slice()),
                });
            });
        }
        const keys = yield utils.promiseParallel({
            users: privsGlobal.getUserPrivilegeList(),
            groups: privsGlobal.getGroupPrivilegeList(),
        });
        const payload = yield utils.promiseParallel({
            labels: getLabels(),
            users: helpers.getUserPrivileges(0, keys.users),
            groups: helpers.getGroupPrivileges(0, keys.groups),
        });
        payload.keys = keys;
        payload.columnCountUserOther = keys.users.length - privsGlobal._coreSize;
        payload.columnCountGroupOther = keys.groups.length - privsGlobal._coreSize;
        return payload;
    });
};
privsGlobal.get = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivilegeList = yield privsGlobal.getUserPrivilegeList();
        const [userPrivileges, isAdministrator] = yield Promise.all([
            helpers.isAllowedTo(userPrivilegeList, uid, 0),
            user_1.default.isAdministrator(uid),
        ]);
        const combined = userPrivileges.map(allowed => allowed || isAdministrator);
        const privData = _.zipObject(userPrivilegeList, combined);
        return yield plugins.hooks.fire('filter:privileges.global.get', privData);
    });
};
privsGlobal.can = function (privilege, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isAdministrator, isUserAllowedTo] = yield Promise.all([
            user_1.default.isAdministrator(uid),
            helpers.isAllowedTo(privilege, uid, [0]),
        ]);
        return isAdministrator || isUserAllowedTo[0];
    });
};
privsGlobal.canGroup = function (privilege, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield groups.isMember(groupName, `cid:0:privileges:groups:${privilege}`);
    });
};
privsGlobal.filterUids = function (privilege, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        const privCategories = require('./categories');
        return yield privCategories.filterUids(privilege, 0, uids);
    });
};
privsGlobal.give = function (privileges, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.join, privileges, 0, groupName);
        plugins.hooks.fire('action:privileges.global.give', {
            privileges: privileges,
            groupNames: Array.isArray(groupName) ? groupName : [groupName],
        });
    });
};
privsGlobal.rescind = function (privileges, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
        plugins.hooks.fire('action:privileges.global.rescind', {
            privileges: privileges,
            groupNames: Array.isArray(groupName) ? groupName : [groupName],
        });
    });
};
privsGlobal.userPrivileges = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivilegeList = yield privsGlobal.getUserPrivilegeList();
        return yield helpers.userOrGroupPrivileges(0, uid, userPrivilegeList);
    });
};
privsGlobal.groupPrivileges = function (groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupPrivilegeList = yield privsGlobal.getGroupPrivilegeList();
        return yield helpers.userOrGroupPrivileges(0, groupName, groupPrivilegeList);
    });
};
