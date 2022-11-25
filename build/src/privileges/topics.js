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
const meta_1 = __importDefault(require("../meta"));
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const helpers = require('./helpers').defualt;
const categories = require('../categories');
const plugins = require('../plugins');
const privsCategories = require('./categories');
const privsTopics = {};
privsTopics.get = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        uid = parseInt(uid, 10);
        const privs = [
            'topics:reply', 'topics:read', 'topics:schedule', 'topics:tag',
            'topics:delete', 'posts:edit', 'posts:history',
            'posts:delete', 'posts:view_deleted', 'read', 'purge',
        ];
        const topicData = yield topics.getTopicFields(tid, ['cid', 'uid', 'locked', 'deleted', 'scheduled']);
        const [userPrivileges, isAdministrator, isModerator, disabled] = yield Promise.all([
            helpers.isAllowedTo(privs, uid, topicData.cid),
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, topicData.cid),
            categories.getCategoryField(topicData.cid, 'disabled'),
        ]);
        const privData = _.zipObject(privs, userPrivileges);
        const isOwner = uid > 0 && uid === topicData.uid;
        const isAdminOrMod = isAdministrator || isModerator;
        const editable = isAdminOrMod;
        const deletable = (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator;
        const mayReply = privsTopics.canViewDeletedScheduled(topicData, {}, false, privData['topics:schedule']);
        return yield plugins.hooks.fire('filter:privileges.topics.get', {
            'topics:reply': (privData['topics:reply'] && ((!topicData.locked && mayReply) || isModerator)) || isAdministrator,
            'topics:read': privData['topics:read'] || isAdministrator,
            'topics:schedule': privData['topics:schedule'] || isAdministrator,
            'topics:tag': privData['topics:tag'] || isAdministrator,
            'topics:delete': (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator,
            'posts:edit': (privData['posts:edit'] && (!topicData.locked || isModerator)) || isAdministrator,
            'posts:history': privData['posts:history'] || isAdministrator,
            'posts:delete': (privData['posts:delete'] && (!topicData.locked || isModerator)) || isAdministrator,
            'posts:view_deleted': privData['posts:view_deleted'] || isAdministrator,
            read: privData.read || isAdministrator,
            purge: (privData.purge && (isOwner || isModerator)) || isAdministrator,
            view_thread_tools: editable || deletable,
            editable: editable,
            deletable: deletable,
            view_deleted: isAdminOrMod || isOwner || privData['posts:view_deleted'],
            view_scheduled: privData['topics:schedule'] || isAdministrator,
            isAdminOrMod: isAdminOrMod,
            disabled: disabled,
            tid: tid,
            uid: uid,
        });
    });
};
privsTopics.can = function (privilege, tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = yield topics.getTopicField(tid, 'cid');
        return yield privsCategories.can(privilege, cid, uid);
    });
};
privsTopics.filterTids = function (privilege, tids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(tids) || !tids.length) {
            return [];
        }
        const topicsData = yield topics.getTopicsFields(tids, ['tid', 'cid', 'deleted', 'scheduled']);
        const cids = _.uniq(topicsData.map((topic) => topic.cid));
        const results = yield privsCategories.getBase(privilege, cids, uid);
        const allowedCids = cids.filter((cid, index) => (!results.categories[index].disabled &&
            (results.allowedTo[index] || results.isAdmin)));
        const cidsSet = new Set(allowedCids);
        const canViewDeleted = _.zipObject(cids, results.view_deleted);
        const canViewScheduled = _.zipObject(cids, results.view_scheduled);
        tids = topicsData.filter((t) => (cidsSet.has(t.cid) &&
            (results.isAdmin || privsTopics.canViewDeletedScheduled(t, {}, canViewDeleted[t.cid], canViewScheduled[t.cid])))).map((t) => t.tid);
        const data = yield plugins.hooks.fire('filter:privileges.topics.filter', {
            privilege: privilege,
            uid: uid,
            tids: tids,
        });
        return data ? data.tids : [];
    });
};
privsTopics.filterUids = function (privilege, tid, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(uids) || !uids.length) {
            return [];
        }
        uids = _.uniq(uids);
        const topicData = yield topics.getTopicFields(tid, ['tid', 'cid', 'deleted', 'scheduled']);
        const [disabled, allowedTo, isAdmins] = yield Promise.all([
            categories.getCategoryField(topicData.cid, 'disabled'),
            helpers.isUsersAllowedTo(privilege, uids, topicData.cid),
            user_1.default.isAdministrator(uids),
        ]);
        if (topicData.scheduled) {
            const canViewScheduled = yield helpers.isUsersAllowedTo('topics:schedule', uids, topicData.cid);
            uids = uids.filter((uid, index) => canViewScheduled[index]);
        }
        return uids.filter((uid, index) => !disabled &&
            ((allowedTo[index] && (topicData.scheduled || !topicData.deleted)) || isAdmins[index]));
    });
};
privsTopics.canPurge = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = yield topics.getTopicField(tid, 'cid');
        const [purge, owner, isAdmin, isModerator] = yield Promise.all([
            privsCategories.isUserAllowedTo('purge', cid, uid),
            topics.isOwner(tid, uid),
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, cid),
        ]);
        return (purge && (owner || isModerator)) || isAdmin;
    });
};
privsTopics.canDelete = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const topicData = yield topics.getTopicFields(tid, ['uid', 'cid', 'postcount', 'deleterUid']);
        const [isModerator, isAdministrator, isOwner, allowedTo] = yield Promise.all([
            user_1.default.isModerator(uid, topicData.cid),
            user_1.default.isAdministrator(uid),
            topics.isOwner(tid, uid),
            helpers.isAllowedTo('topics:delete', uid, [topicData.cid]),
        ]);
        if (isAdministrator) {
            return true;
        }
        const { preventTopicDeleteAfterReplies } = meta_1.default.config;
        if (!isModerator && preventTopicDeleteAfterReplies && (topicData.postcount - 1) >= preventTopicDeleteAfterReplies) {
            const langKey = preventTopicDeleteAfterReplies > 1 ?
                `[[error:cant-delete-topic-has-replies, ${meta_1.default.config.preventTopicDeleteAfterReplies}]]` :
                '[[error:cant-delete-topic-has-reply]]';
            throw new Error(langKey);
        }
        const { deleterUid } = topicData;
        return allowedTo[0] && ((isOwner && (deleterUid === 0 || deleterUid === topicData.uid)) || isModerator);
    });
};
privsTopics.canEdit = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield privsTopics.isOwnerOrAdminOrMod(tid, uid);
    });
};
privsTopics.isOwnerOrAdminOrMod = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isOwner, isAdminOrMod] = yield Promise.all([
            topics.isOwner(tid, uid),
            privsTopics.isAdminOrMod(tid, uid),
        ]);
        return isOwner || isAdminOrMod;
    });
};
privsTopics.isAdminOrMod = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return false;
        }
        const cid = yield topics.getTopicField(tid, 'cid');
        return yield privsCategories.isAdminOrMod(cid, uid);
    });
};
privsTopics.canViewDeletedScheduled = function (topic, privileges = {}, viewDeleted = false, viewScheduled = false) {
    if (!topic) {
        return false;
    }
    const { deleted = false, scheduled = false } = topic;
    const { view_deleted = viewDeleted, view_scheduled = viewScheduled } = privileges;
    // conceptually exclusive, scheduled topics deemed to be not deleted (they can only be purged)
    if (scheduled) {
        return view_scheduled;
    }
    else if (deleted) {
        return view_deleted;
    }
    return true;
};
exports.default = privsTopics;
