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
const privsAdmin = {};
/**
 * Looking to add a new admin privilege via plugin/theme? Attach a hook to
 * `static:privileges.admin.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
    ['admin:dashboard', { label: '[[admin/manage/privileges:admin-dashboard]]' }],
    ['admin:categories', { label: '[[admin/manage/privileges:admin-categories]]' }],
    ['admin:privileges', { label: '[[admin/manage/privileges:admin-privileges]]' }],
    ['admin:admins-mods', { label: '[[admin/manage/privileges:admin-admins-mods]]' }],
    ['admin:users', { label: '[[admin/manage/privileges:admin-users]]' }],
    ['admin:groups', { label: '[[admin/manage/privileges:admin-groups]]' }],
    ['admin:tags', { label: '[[admin/manage/privileges:admin-tags]]' }],
    ['admin:settings', { label: '[[admin/manage/privileges:admin-settings]]' }],
]);
privsAdmin.getUserPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.admin.list', Array.from(_privilegeMap.keys())); });
privsAdmin.getGroupPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.admin.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`)); });
privsAdmin.getPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () {
    const [user, group] = yield Promise.all([
        privsAdmin.getUserPrivilegeList(),
        privsAdmin.getGroupPrivilegeList(),
    ]);
    return user.concat(group);
});
privsAdmin.init = () => __awaiter(void 0, void 0, void 0, function* () {
    yield plugins.hooks.fire('static:privileges.admin.init', {
        privileges: _privilegeMap,
    });
});
// Mapping for a page route (via direct match or regexp) to a privilege
privsAdmin.routeMap = {
    dashboard: 'admin:dashboard',
    'manage/categories': 'admin:categories',
    'manage/privileges': 'admin:privileges',
    'manage/admins-mods': 'admin:admins-mods',
    'manage/users': 'admin:users',
    'manage/groups': 'admin:groups',
    'manage/tags': 'admin:tags',
    'settings/tags': 'admin:tags',
    'extend/plugins': 'admin:settings',
    'extend/widgets': 'admin:settings',
    'extend/rewards': 'admin:settings',
};
privsAdmin.routePrefixMap = {
    'manage/categories/': 'admin:categories',
    'manage/privileges/': 'admin:privileges',
    'manage/groups/': 'admin:groups',
    'settings/': 'admin:settings',
    'appearance/': 'admin:settings',
    'plugins/': 'admin:settings',
};
// Mapping for socket call methods to a privilege
// In NodeBB v2, these socket calls will be removed in favour of xhr calls
privsAdmin.socketMap = {
    'admin.rooms.getAll': 'admin:dashboard',
    'admin.analytics.get': 'admin:dashboard',
    'admin.categories.copySettingsFrom': 'admin:categories',
    'admin.categories.copyPrivilegesToChildren': 'admin:privileges',
    'admin.categories.copyPrivilegesFrom': 'admin:privileges',
    'admin.categories.copyPrivilegesToAllCategories': 'admin:privileges',
    'admin.user.makeAdmins': 'admin:admins-mods',
    'admin.user.removeAdmins': 'admin:admins-mods',
    'admin.user.loadGroups': 'admin:users',
    'admin.groups.join': 'admin:users',
    'admin.groups.leave': 'admin:users',
    'admin.user.resetLockouts': 'admin:users',
    'admin.user.validateEmail': 'admin:users',
    'admin.user.sendValidationEmail': 'admin:users',
    'admin.user.sendPasswordResetEmail': 'admin:users',
    'admin.user.forcePasswordReset': 'admin:users',
    'admin.user.invite': 'admin:users',
    'admin.tags.create': 'admin:tags',
    'admin.tags.rename': 'admin:tags',
    'admin.tags.deleteTags': 'admin:tags',
    'admin.getSearchDict': 'admin:settings',
    'admin.config.setMultiple': 'admin:settings',
    'admin.config.remove': 'admin:settings',
    'admin.themes.getInstalled': 'admin:settings',
    'admin.themes.set': 'admin:settings',
    'admin.reloadAllSessions': 'admin:settings',
    'admin.settings.get': 'admin:settings',
    'admin.settings.set': 'admin:settings',
};
privsAdmin.resolve = (path) => {
    if (privsAdmin.routeMap.hasOwnProperty(path)) {
        return privsAdmin.routeMap[path];
    }
    const found = Object.entries(privsAdmin.routePrefixMap).find(entry => path.startsWith(entry[0]));
    return found ? found[1] : undefined;
};
privsAdmin.list = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privilegeLabels = Array.from(_privilegeMap.values()).map(data => data.label);
        const userPrivilegeList = yield privsAdmin.getUserPrivilegeList();
        const groupPrivilegeList = yield privsAdmin.getGroupPrivilegeList();
        // Restrict privileges column to superadmins
        if (!(yield user_1.default.isAdministrator(uid))) {
            const idx = Array.from(_privilegeMap.keys()).indexOf('admin:privileges');
            privilegeLabels.splice(idx, 1);
            userPrivilegeList.splice(idx, 1);
            groupPrivilegeList.splice(idx, 1);
        }
        const labels = yield utils.promiseParallel({
            users: plugins.hooks.fire('filter:privileges.admin.list_human', privilegeLabels.slice()),
            groups: plugins.hooks.fire('filter:privileges.admin.groups.list_human', privilegeLabels.slice()),
        });
        const keys = {
            users: userPrivilegeList,
            groups: groupPrivilegeList,
        };
        const payload = yield utils.promiseParallel({
            labels,
            users: helpers.getUserPrivileges(0, keys.users),
            groups: helpers.getGroupPrivileges(0, keys.groups),
        });
        payload.keys = keys;
        return payload;
    });
};
privsAdmin.get = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivilegeList = yield privsAdmin.getUserPrivilegeList();
        const [userPrivileges, isAdministrator] = yield Promise.all([
            helpers.isAllowedTo(userPrivilegeList, uid, 0),
            user_1.default.isAdministrator(uid),
        ]);
        const combined = userPrivileges.map(allowed => allowed || isAdministrator);
        const privData = _.zipObject(userPrivilegeList, combined);
        privData.superadmin = isAdministrator;
        return yield plugins.hooks.fire('filter:privileges.admin.get', privData);
    });
};
privsAdmin.can = function (privilege, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isUserAllowedTo, isAdministrator] = yield Promise.all([
            helpers.isAllowedTo(privilege, uid, [0]),
            user_1.default.isAdministrator(uid),
        ]);
        return isAdministrator || isUserAllowedTo[0];
    });
};
privsAdmin.canGroup = function (privilege, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield groups.isMember(groupName, `cid:0:privileges:groups:${privilege}`);
    });
};
privsAdmin.give = function (privileges, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.join, privileges, 0, groupName);
        plugins.hooks.fire('action:privileges.admin.give', {
            privileges: privileges,
            groupNames: Array.isArray(groupName) ? groupName : [groupName],
        });
    });
};
privsAdmin.rescind = function (privileges, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
        plugins.hooks.fire('action:privileges.admin.rescind', {
            privileges: privileges,
            groupNames: Array.isArray(groupName) ? groupName : [groupName],
        });
    });
};
privsAdmin.userPrivileges = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivilegeList = yield privsAdmin.getUserPrivilegeList();
        return yield helpers.userOrGroupPrivileges(0, uid, userPrivilegeList);
    });
};
privsAdmin.groupPrivileges = function (groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupPrivilegeList = yield privsAdmin.getGroupPrivilegeList();
        return yield helpers.userOrGroupPrivileges(0, groupName, groupPrivilegeList);
    });
};
