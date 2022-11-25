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
const categories = require('../categories');
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const helpers = require('./helpers').defualt;
const plugins = require('../plugins');
const utils = require('../utils');
const privsCategories = {};
/**
 * Looking to add a new category privilege via plugin/theme? Attach a hook to
 * `static:privileges.category.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
    ['find', { label: '[[admin/manage/privileges:find-category]]' }],
    ['read', { label: '[[admin/manage/privileges:access-category]]' }],
    ['topics:read', { label: '[[admin/manage/privileges:access-topics]]' }],
    ['topics:create', { label: '[[admin/manage/privileges:create-topics]]' }],
    ['topics:reply', { label: '[[admin/manage/privileges:reply-to-topics]]' }],
    ['topics:schedule', { label: '[[admin/manage/privileges:schedule-topics]]' }],
    ['topics:tag', { label: '[[admin/manage/privileges:tag-topics]]' }],
    ['posts:edit', { label: '[[admin/manage/privileges:edit-posts]]' }],
    ['posts:history', { label: '[[admin/manage/privileges:view-edit-history]]' }],
    ['posts:delete', { label: '[[admin/manage/privileges:delete-posts]]' }],
    ['posts:upvote', { label: '[[admin/manage/privileges:upvote-posts]]' }],
    ['posts:downvote', { label: '[[admin/manage/privileges:downvote-posts]]' }],
    ['topics:delete', { label: '[[admin/manage/privileges:delete-topics]]' }],
    ['posts:view_deleted', { label: '[[admin/manage/privileges:view_deleted]]' }],
    ['purge', { label: '[[admin/manage/privileges:purge]]' }],
    ['moderate', { label: '[[admin/manage/privileges:moderate]]' }],
]);
privsCategories.getUserPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.list', Array.from(_privilegeMap.keys())); });
privsCategories.getGroupPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () { return yield plugins.hooks.fire('filter:privileges.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`)); });
privsCategories.getPrivilegeList = () => __awaiter(void 0, void 0, void 0, function* () {
    const [user, group] = yield Promise.all([
        privsCategories.getUserPrivilegeList(),
        privsCategories.getGroupPrivilegeList(),
    ]);
    return user.concat(group);
});
privsCategories.init = () => __awaiter(void 0, void 0, void 0, function* () {
    yield plugins.hooks.fire('static:privileges.categories.init', {
        privileges: _privilegeMap,
    });
});
// Method used in admin/category controller to show all users/groups with privs in that given cid
privsCategories.list = function (cid) {
    return __awaiter(this, void 0, void 0, function* () {
        let labels = Array.from(_privilegeMap.values()).map(data => data.label);
        labels = yield utils.promiseParallel({
            users: plugins.hooks.fire('filter:privileges.list_human', labels.slice()),
            groups: plugins.hooks.fire('filter:privileges.groups.list_human', labels.slice()),
        });
        const keys = yield utils.promiseParallel({
            users: privsCategories.getUserPrivilegeList(),
            groups: privsCategories.getGroupPrivilegeList(),
        });
        const payload = yield utils.promiseParallel({
            labels,
            users: helpers.getUserPrivileges(cid, keys.users),
            groups: helpers.getGroupPrivileges(cid, keys.groups),
        });
        payload.keys = keys;
        payload.columnCountUserOther = payload.labels.users.length - labels.users.length;
        payload.columnCountGroupOther = payload.labels.groups.length - labels.groups.length;
        return payload;
    });
};
privsCategories.get = function (cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const privs = [
            'topics:create', 'topics:read', 'topics:schedule',
            'topics:tag', 'read', 'posts:view_deleted',
        ];
        const [userPrivileges, isAdministrator, isModerator] = yield Promise.all([
            helpers.isAllowedTo(privs, uid, cid),
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, cid),
        ]);
        const combined = userPrivileges.map(allowed => allowed || isAdministrator);
        const privData = _.zipObject(privs, combined);
        const isAdminOrMod = isAdministrator || isModerator;
        return yield plugins.hooks.fire('filter:privileges.categories.get', Object.assign(Object.assign({}, privData), { cid: cid, uid: uid, editable: isAdminOrMod, view_deleted: isAdminOrMod || privData['posts:view_deleted'], isAdminOrMod: isAdminOrMod }));
    });
};
privsCategories.isAdminOrMod = function (cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return false;
        }
        const [isAdmin, isMod] = yield Promise.all([
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, cid),
        ]);
        return isAdmin || isMod;
    });
};
privsCategories.isUserAllowedTo = function (privilege, cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((Array.isArray(privilege) && !privilege.length) || (Array.isArray(cid) && !cid.length)) {
            return [];
        }
        if (!cid) {
            return false;
        }
        const results = yield helpers.isAllowedTo(privilege, uid, Array.isArray(cid) ? cid : [cid]);
        if (Array.isArray(results) && results.length) {
            return Array.isArray(cid) ? results : results[0];
        }
        return false;
    });
};
privsCategories.can = function (privilege, cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cid) {
            return false;
        }
        const [disabled, isAdmin, isAllowed] = yield Promise.all([
            categories.getCategoryField(cid, 'disabled'),
            user_1.default.isAdministrator(uid),
            privsCategories.isUserAllowedTo(privilege, cid, uid),
        ]);
        return !disabled && (isAllowed || isAdmin);
    });
};
privsCategories.filterCids = function (privilege, cids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(cids) || !cids.length) {
            return [];
        }
        cids = _.uniq(cids);
        const [categoryData, allowedTo, isAdmin] = yield Promise.all([
            categories.getCategoriesFields(cids, ['disabled']),
            helpers.isAllowedTo(privilege, uid, cids),
            user_1.default.isAdministrator(uid),
        ]);
        return cids.filter((cid, index) => !!cid && !categoryData[index].disabled && (allowedTo[index] || isAdmin));
    });
};
privsCategories.getBase = function (privilege, cids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            categories: categories.getCategoriesFields(cids, ['disabled']),
            allowedTo: helpers.isAllowedTo(privilege, uid, cids),
            view_deleted: helpers.isAllowedTo('posts:view_deleted', uid, cids),
            view_scheduled: helpers.isAllowedTo('topics:schedule', uid, cids),
            isAdmin: user_1.default.isAdministrator(uid),
        });
    });
};
privsCategories.filterUids = function (privilege, cid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!uids.length) {
            return [];
        }
        uids = _.uniq(uids);
        const [allowedTo, isAdmins] = yield Promise.all([
            helpers.isUsersAllowedTo(privilege, uids, cid),
            user_1.default.isAdministrator(uids),
        ]);
        return uids.filter((uid, index) => allowedTo[index] || isAdmins[index]);
    });
};
privsCategories.give = function (privileges, cid, members) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.join, privileges, cid, members);
        plugins.hooks.fire('action:privileges.categories.give', {
            privileges: privileges,
            cids: Array.isArray(cid) ? cid : [cid],
            members: Array.isArray(members) ? members : [members],
        });
    });
};
privsCategories.rescind = function (privileges, cid, members) {
    return __awaiter(this, void 0, void 0, function* () {
        yield helpers.giveOrRescind(groups.leave, privileges, cid, members);
        plugins.hooks.fire('action:privileges.categories.rescind', {
            privileges: privileges,
            cids: Array.isArray(cid) ? cid : [cid],
            members: Array.isArray(members) ? members : [members],
        });
    });
};
privsCategories.canMoveAllTopics = function (currentCid, targetCid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isAdmin, isModerators] = yield Promise.all([
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, [currentCid, targetCid]),
        ]);
        return isAdmin || !isModerators.includes(false);
    });
};
privsCategories.userPrivileges = function (cid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPrivilegeList = yield privsCategories.getUserPrivilegeList();
        return yield helpers.userOrGroupPrivileges(cid, uid, userPrivilegeList);
    });
};
privsCategories.groupPrivileges = function (cid, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        const groupPrivilegeList = yield privsCategories.getGroupPrivilegeList();
        return yield helpers.userOrGroupPrivileges(cid, groupName, groupPrivilegeList);
    });
};
exports.default = privsCategories;
