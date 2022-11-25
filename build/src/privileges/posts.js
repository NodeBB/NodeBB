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
const posts = require('../posts');
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const helpers = require('./helpers').defualt;
const plugins = require('../plugins');
const utils = require('../utils');
const privsCategories = require('./categories');
const privsTopics = require('./topics');
const privsPosts = {};
privsPosts.get = function (pids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const cids = yield posts.getCidsByPids(pids);
        const uniqueCids = _.uniq(cids);
        const results = yield utils.promiseParallel({
            isAdmin: user_1.default.isAdministrator(uid),
            isModerator: user_1.default.isModerator(uid, uniqueCids),
            isOwner: posts.isOwner(pids, uid),
            'topics:read': helpers.isAllowedTo('topics:read', uid, uniqueCids),
            read: helpers.isAllowedTo('read', uid, uniqueCids),
            'posts:edit': helpers.isAllowedTo('posts:edit', uid, uniqueCids),
            'posts:history': helpers.isAllowedTo('posts:history', uid, uniqueCids),
            'posts:view_deleted': helpers.isAllowedTo('posts:view_deleted', uid, uniqueCids),
        });
        const isModerator = _.zipObject(uniqueCids, results.isModerator);
        const privData = {};
        privData['topics:read'] = _.zipObject(uniqueCids, results['topics:read']);
        privData.read = _.zipObject(uniqueCids, results.read);
        privData['posts:edit'] = _.zipObject(uniqueCids, results['posts:edit']);
        privData['posts:history'] = _.zipObject(uniqueCids, results['posts:history']);
        privData['posts:view_deleted'] = _.zipObject(uniqueCids, results['posts:view_deleted']);
        const privileges = cids.map((cid, i) => {
            const isAdminOrMod = results.isAdmin || isModerator[cid];
            const editable = (privData['posts:edit'][cid] && (results.isOwner[i] || results.isModerator)) || results.isAdmin;
            const viewDeletedPosts = results.isOwner[i] || privData['posts:view_deleted'][cid] || results.isAdmin;
            const viewHistory = results.isOwner[i] || privData['posts:history'][cid] || results.isAdmin;
            return {
                editable: editable,
                move: isAdminOrMod,
                isAdminOrMod: isAdminOrMod,
                'topics:read': privData['topics:read'][cid] || results.isAdmin,
                read: privData.read[cid] || results.isAdmin,
                'posts:history': viewHistory,
                'posts:view_deleted': viewDeletedPosts,
            };
        });
        return privileges;
    });
};
privsPosts.can = function (privilege, pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = yield posts.getCidByPid(pid);
        return yield privsCategories.can(privilege, cid, uid);
    });
};
privsPosts.filter = function (privilege, pids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        pids = _.uniq(pids);
        const postData = yield posts.getPostsFields(pids, ['uid', 'tid', 'deleted']);
        const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
        const topicData = yield topics.getTopicsFields(tids, ['deleted', 'scheduled', 'cid']);
        const tidToTopic = _.zipObject(tids, topicData);
        let cids = postData.map((post, index) => {
            if (post) {
                post.pid = pids[index];
                post.topic = tidToTopic[post.tid];
            }
            return tidToTopic[post.tid] && tidToTopic[post.tid].cid;
        }).filter((cid) => parseInt(cid, 10));
        cids = _.uniq(cids);
        const results = yield privsCategories.getBase(privilege, cids, uid);
        const allowedCids = cids.filter((cid, index) => !results.categories[index].disabled &&
            (results.allowedTo[index] || results.isAdmin));
        const cidsSet = new Set(allowedCids);
        const canViewDeleted = _.zipObject(cids, results.view_deleted);
        const canViewScheduled = _.zipObject(cids, results.view_scheduled);
        pids = postData.filter(post => (post.topic &&
            cidsSet.has(post.topic.cid) &&
            (privsTopics.canViewDeletedScheduled({
                deleted: post.topic.deleted || post.deleted,
                scheduled: post.topic.scheduled,
            }, {}, canViewDeleted[post.topic.cid], canViewScheduled[post.topic.cid]) || results.isAdmin))).map(post => post.pid);
        const data = yield plugins.hooks.fire('filter:privileges.posts.filter', {
            privilege: privilege,
            uid: uid,
            pids: pids,
        });
        return data ? data.pids : null;
    });
};
privsPosts.canEdit = function (pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield utils.promiseParallel({
            isAdmin: user_1.default.isAdministrator(uid),
            isMod: posts.isModerator([pid], uid),
            owner: posts.isOwner(pid, uid),
            edit: privsPosts.can('posts:edit', pid, uid),
            postData: posts.getPostFields(pid, ['tid', 'timestamp', 'deleted', 'deleterUid']),
            userData: user_1.default.getUserFields(uid, ['reputation']),
        });
        results.isMod = results.isMod[0];
        if (results.isAdmin) {
            return { flag: true };
        }
        if (!results.isMod &&
            meta_1.default.config.postEditDuration &&
            (Date.now() - results.postData.timestamp > meta_1.default.config.postEditDuration * 1000)) {
            return { flag: false, message: `[[error:post-edit-duration-expired, ${meta_1.default.config.postEditDuration}]]` };
        }
        if (!results.isMod &&
            meta_1.default.config.newbiePostEditDuration > 0 &&
            meta_1.default.config.newbiePostDelayThreshold > results.userData.reputation &&
            Date.now() - results.postData.timestamp > meta_1.default.config.newbiePostEditDuration * 1000) {
            return { flag: false, message: `[[error:post-edit-duration-expired, ${meta_1.default.config.newbiePostEditDuration}]]` };
        }
        const isLocked = yield topics.isLocked(results.postData.tid);
        if (!results.isMod && isLocked) {
            return { flag: false, message: '[[error:topic-locked]]' };
        }
        if (!results.isMod && results.postData.deleted && parseInt(uid, 10) !== parseInt(results.postData.deleterUid, 10)) {
            return { flag: false, message: '[[error:post-deleted]]' };
        }
        results.pid = parseInt(pid, 10);
        results.uid = uid;
        const result = yield plugins.hooks.fire('filter:privileges.posts.edit', results);
        return { flag: result.edit && (result.owner || result.isMod), message: '[[error:no-privileges]]' };
    });
};
privsPosts.canDelete = function (pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const postData = yield posts.getPostFields(pid, ['uid', 'tid', 'timestamp', 'deleterUid']);
        const results = yield utils.promiseParallel({
            isAdmin: user_1.default.isAdministrator(uid),
            isMod: posts.isModerator([pid], uid),
            isLocked: topics.isLocked(postData.tid),
            isOwner: posts.isOwner(pid, uid),
            'posts:delete': privsPosts.can('posts:delete', pid, uid),
        });
        results.isMod = results.isMod[0];
        if (results.isAdmin) {
            return { flag: true };
        }
        if (!results.isMod && results.isLocked) {
            return { flag: false, message: '[[error:topic-locked]]' };
        }
        const { postDeleteDuration } = meta_1.default.config;
        if (!results.isMod && postDeleteDuration && (Date.now() - postData.timestamp > postDeleteDuration * 1000)) {
            return { flag: false, message: `[[error:post-delete-duration-expired, ${meta_1.default.config.postDeleteDuration}]]` };
        }
        const { deleterUid } = postData;
        const flag = results['posts:delete'] && ((results.isOwner && (deleterUid === 0 || deleterUid === postData.uid)) || results.isMod);
        return { flag: flag, message: '[[error:no-privileges]]' };
    });
};
privsPosts.canFlag = function (pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetUid = yield posts.getPostField(pid, 'uid');
        const [userReputation, isAdminOrModerator, targetPrivileged, reporterPrivileged] = yield Promise.all([
            user_1.default.getUserField(uid, 'reputation'),
            isAdminOrMod(pid, uid),
            user_1.default.isPrivileged(targetUid),
            user_1.default.isPrivileged(uid),
        ]);
        const minimumReputation = meta_1.default.config['min:rep:flag'];
        let canFlag = isAdminOrModerator || (userReputation >= minimumReputation);
        if (targetPrivileged && !reporterPrivileged) {
            canFlag = false;
        }
        return { flag: canFlag };
    });
};
privsPosts.canMove = function (pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const isMain = yield posts.isMain(pid);
        if (isMain) {
            throw new Error('[[error:cant-move-mainpost]]');
        }
        return yield isAdminOrMod(pid, uid);
    });
};
privsPosts.canPurge = function (pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = yield posts.getCidByPid(pid);
        const results = yield utils.promiseParallel({
            purge: privsCategories.isUserAllowedTo('purge', cid, uid),
            owner: posts.isOwner(pid, uid),
            isAdmin: user_1.default.isAdministrator(uid),
            isModerator: user_1.default.isModerator(uid, cid),
        });
        return (results.purge && (results.owner || results.isModerator)) || results.isAdmin;
    });
};
function isAdminOrMod(pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0) {
            return false;
        }
        const cid = yield posts.getCidByPid(pid);
        return yield privsCategories.isAdminOrMod(cid, uid);
    });
}
exports.default = privsPosts;
