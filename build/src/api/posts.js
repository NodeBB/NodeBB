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
const _ = require('lodash');
const utils = require('../utils');
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const topics = require('../topics');
const groups = require('../groups');
const meta_1 = __importDefault(require("../meta"));
const events = require('../events');
const privileges = require('../privileges');
const apiHelpers = require('./helpers').defualt;
const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');
const postsAPI = {};
postsAPI.get = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userPrivileges, post, voted] = yield Promise.all([
            privileges.posts.get([data.pid], caller.uid),
            posts.getPostData(data.pid),
            posts.hasVoted(data.pid, caller.uid),
        ]);
        if (!post) {
            return null;
        }
        Object.assign(post, voted);
        const userPrivilege = userPrivileges[0];
        if (!userPrivilege.read || !userPrivilege['topics:read']) {
            return null;
        }
        post.ip = userPrivilege.isAdminOrMod ? post.ip : undefined;
        const selfPost = caller.uid && caller.uid === parseInt(post.uid, 10);
        if (post.deleted && !(userPrivilege.isAdminOrMod || selfPost)) {
            post.content = '[[topic:post_is_deleted]]';
        }
        return post;
    });
};
postsAPI.edit = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.pid || (meta_1.default.config.minimumPostLength !== 0 && !data.content)) {
            throw new Error('[[error:invalid-data]]');
        }
        if (!caller.uid) {
            throw new Error('[[error:not-logged-in]]');
        }
        // Trim and remove HTML (latter for composers that send in HTML, like redactor)
        const contentLen = utils.stripHTMLTags(data.content).trim().length;
        if (data.title && data.title.length < meta_1.default.config.minimumTitleLength) {
            throw new Error(`[[error:title-too-short, ${meta_1.default.config.minimumTitleLength}]]`);
        }
        else if (data.title && data.title.length > meta_1.default.config.maximumTitleLength) {
            throw new Error(`[[error:title-too-long, ${meta_1.default.config.maximumTitleLength}]]`);
        }
        else if (meta_1.default.config.minimumPostLength !== 0 && contentLen < meta_1.default.config.minimumPostLength) {
            throw new Error(`[[error:content-too-short, ${meta_1.default.config.minimumPostLength}]]`);
        }
        else if (contentLen > meta_1.default.config.maximumPostLength) {
            throw new Error(`[[error:content-too-long, ${meta_1.default.config.maximumPostLength}]]`);
        }
        data.uid = caller.uid;
        data.req = apiHelpers.buildReqObject(caller);
        data.timestamp = parseInt(data.timestamp, 10) || Date.now();
        const editResult = yield posts.edit(data);
        if (editResult.topic.isMainPost) {
            yield topics.thumbs.migrate(data.uuid, editResult.topic.tid);
        }
        const selfPost = parseInt(caller.uid, 10) === parseInt(editResult.post.uid, 10);
        if (!selfPost && editResult.post.changed) {
            yield events.log({
                type: `post-edit`,
                uid: caller.uid,
                ip: caller.ip,
                pid: editResult.post.pid,
                oldContent: editResult.post.oldContent,
                newContent: editResult.post.newContent,
            });
        }
        if (editResult.topic.renamed) {
            yield events.log({
                type: 'topic-rename',
                uid: caller.uid,
                ip: caller.ip,
                tid: editResult.topic.tid,
                oldTitle: validator.escape(String(editResult.topic.oldTitle)),
                newTitle: validator.escape(String(editResult.topic.title)),
            });
        }
        const postObj = yield posts.getPostSummaryByPids([editResult.post.pid], caller.uid, {});
        const returnData = Object.assign(Object.assign({}, postObj[0]), editResult.post);
        returnData.topic = Object.assign(Object.assign({}, postObj[0].topic), editResult.post.topic);
        if (!editResult.post.deleted) {
            websockets.in(`topic_${editResult.topic.tid}`).emit('event:post_edited', editResult);
            return returnData;
        }
        const memberData = yield groups.getMembersOfGroups([
            'administrators',
            'Global Moderators',
            `cid:${editResult.topic.cid}:privileges:moderate`,
            `cid:${editResult.topic.cid}:privileges:groups:moderate`,
        ]);
        const uids = _.uniq(_.flatten(memberData).concat(String(caller.uid)));
        uids.forEach(uid => websockets.in(`uid_${uid}`).emit('event:post_edited', editResult));
        return returnData;
    });
};
postsAPI.delete = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield deleteOrRestore(caller, data, {
            command: 'delete',
            event: 'event:post_deleted',
            type: 'post-delete',
        });
    });
};
postsAPI.restore = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield deleteOrRestore(caller, data, {
            command: 'restore',
            event: 'event:post_restored',
            type: 'post-restore',
        });
    });
};
function deleteOrRestore(caller, data, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.pid) {
            throw new Error('[[error:invalid-data]]');
        }
        const postData = yield posts.tools[params.command](caller.uid, data.pid);
        const results = yield isMainAndLastPost(data.pid);
        if (results.isMain && results.isLast) {
            yield deleteOrRestoreTopicOf(params.command, data.pid, caller);
        }
        websockets.in(`topic_${postData.tid}`).emit(params.event, postData);
        yield events.log({
            type: params.type,
            uid: caller.uid,
            pid: data.pid,
            tid: postData.tid,
            ip: caller.ip,
        });
    });
}
function deleteOrRestoreTopicOf(command, pid, caller) {
    return __awaiter(this, void 0, void 0, function* () {
        const topic = yield posts.getTopicFields(pid, ['tid', 'cid', 'deleted', 'scheduled']);
        // exempt scheduled topics from being deleted/restored
        if (topic.scheduled) {
            return;
        }
        // command: delete/restore
        yield apiHelpers.doTopicAction(command, topic.deleted ? 'event:topic_restored' : 'event:topic_deleted', caller, { tids: [topic.tid], cid: topic.cid });
    });
}
postsAPI.purge = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !parseInt(data.pid, 10)) {
            throw new Error('[[error:invalid-data]]');
        }
        const results = yield isMainAndLastPost(data.pid);
        if (results.isMain && !results.isLast) {
            throw new Error('[[error:cant-purge-main-post]]');
        }
        const isMainAndLast = results.isMain && results.isLast;
        const postData = yield posts.getPostFields(data.pid, ['toPid', 'tid']);
        postData.pid = data.pid;
        const canPurge = yield privileges.posts.canPurge(data.pid, caller.uid);
        if (!canPurge) {
            throw new Error('[[error:no-privileges]]');
        }
        require('../posts/cache').del(data.pid);
        yield posts.purge(data.pid, caller.uid);
        websockets.in(`topic_${postData.tid}`).emit('event:post_purged', postData);
        const topicData = yield topics.getTopicFields(postData.tid, ['title', 'cid']);
        yield events.log({
            type: 'post-purge',
            pid: data.pid,
            uid: caller.uid,
            ip: caller.ip,
            tid: postData.tid,
            title: String(topicData.title),
        });
        if (isMainAndLast) {
            yield apiHelpers.doTopicAction('purge', 'event:topic_purged', caller, { tids: [postData.tid], cid: topicData.cid });
        }
    });
};
function isMainAndLastPost(pid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [isMain, topicData] = yield Promise.all([
            posts.isMain(pid),
            posts.getTopicFields(pid, ['postcount']),
        ]);
        return {
            isMain: isMain,
            isLast: topicData && topicData.postcount === 1,
        };
    });
}
postsAPI.move = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller.uid) {
            throw new Error('[[error:not-logged-in]]');
        }
        if (!data || !data.pid || !data.tid) {
            throw new Error('[[error:invalid-data]]');
        }
        const canMove = yield Promise.all([
            privileges.topics.isAdminOrMod(data.tid, caller.uid),
            privileges.posts.canMove(data.pid, caller.uid),
        ]);
        if (!canMove.every(Boolean)) {
            throw new Error('[[error:no-privileges]]');
        }
        yield topics.movePostToTopic(caller.uid, data.pid, data.tid);
        const [postDeleted, topicDeleted] = yield Promise.all([
            posts.getPostField(data.pid, 'deleted'),
            topics.getTopicField(data.tid, 'deleted'),
            yield events.log({
                type: `post-move`,
                uid: caller.uid,
                ip: caller.ip,
                pid: data.pid,
                toTid: data.tid,
            }),
        ]);
        if (!postDeleted && !topicDeleted) {
            socketHelpers.sendNotificationToPostOwner(data.pid, caller.uid, 'move', 'notifications:moved_your_post');
        }
    });
};
postsAPI.upvote = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield apiHelpers.postCommand(caller, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data);
    });
};
postsAPI.downvote = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield apiHelpers.postCommand(caller, 'downvote', 'voted', '', data);
    });
};
postsAPI.unvote = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield apiHelpers.postCommand(caller, 'unvote', 'voted', '', data);
    });
};
postsAPI.bookmark = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield apiHelpers.postCommand(caller, 'bookmark', 'bookmarked', '', data);
    });
};
postsAPI.unbookmark = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield apiHelpers.postCommand(caller, 'unbookmark', 'bookmarked', '', data);
    });
};
function diffsPrivilegeCheck(pid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const [deleted, privilegesData] = yield Promise.all([
            posts.getPostField(pid, 'deleted'),
            privileges.posts.get([pid], uid),
        ]);
        const allowed = privilegesData[0]['posts:history'] && (deleted ? privilegesData[0]['posts:view_deleted'] : true);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
postsAPI.getDiffs = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield diffsPrivilegeCheck(data.pid, caller.uid);
    const timestamps = yield posts.diffs.list(data.pid);
    const post = yield posts.getPostFields(data.pid, ['timestamp', 'uid']);
    const diffs = yield posts.diffs.get(data.pid);
    const uids = diffs.map(diff => diff.uid || null);
    uids.push(post.uid);
    let usernames = yield user_1.default.getUsersFields(uids, ['username']);
    usernames = usernames.map(userObj => (userObj.uid ? userObj.username : null));
    const cid = yield posts.getCidByPid(data.pid);
    const [isAdmin, isModerator] = yield Promise.all([
        user_1.default.isAdministrator(caller.uid),
        privileges.users.isModerator(caller.uid, cid),
    ]);
    // timestamps returned by posts.diffs.list are strings
    timestamps.push(String(post.timestamp));
    return {
        timestamps: timestamps,
        revisions: timestamps.map((timestamp, idx) => ({
            timestamp: timestamp,
            username: usernames[idx],
        })),
        // Only admins, global mods and moderator of that cid can delete a diff
        deletable: isAdmin || isModerator,
        // These and post owners can restore to a different post version
        editable: isAdmin || isModerator || parseInt(caller.uid, 10) === parseInt(post.uid, 10),
    };
});
postsAPI.loadDiff = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield diffsPrivilegeCheck(data.pid, caller.uid);
    return yield posts.diffs.load(data.pid, data.since, caller.uid);
});
postsAPI.restoreDiff = (caller, data) => __awaiter(void 0, void 0, void 0, function* () {
    const cid = yield posts.getCidByPid(data.pid);
    const canEdit = yield privileges.categories.can('posts:edit', cid, caller.uid);
    if (!canEdit) {
        throw new Error('[[error:no-privileges]]');
    }
    const edit = yield posts.diffs.restore(data.pid, data.since, caller.uid, apiHelpers.buildReqObject(caller));
    websockets.in(`topic_${edit.topic.tid}`).emit('event:post_edited', edit);
});
