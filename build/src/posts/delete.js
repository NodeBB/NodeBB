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
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const topics = require('../topics');
const categories = require('../categories');
const user_1 = __importDefault(require("../user"));
const notifications = require('../notifications');
const plugins = require('../plugins');
const flags = require('../flags');
function default_1(Posts) {
    Posts.delete = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield deleteOrRestore('delete', pid, uid);
        });
    };
    Posts.restore = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield deleteOrRestore('restore', pid, uid);
        });
    };
    function deleteOrRestore(type, pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const isDeleting = type === 'delete';
            yield plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });
            yield Posts.setPostFields(pid, {
                deleted: isDeleting ? 1 : 0,
                deleterUid: isDeleting ? uid : 0,
            });
            const postData = yield Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp']);
            const topicData = yield topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned']);
            postData.cid = topicData.cid;
            yield Promise.all([
                topics.updateLastPostTimeFromLastPid(postData.tid),
                topics.updateTeaser(postData.tid),
                isDeleting ?
                    db.sortedSetRemove(`cid:${topicData.cid}:pids`, pid) :
                    db.sortedSetAdd(`cid:${topicData.cid}:pids`, postData.timestamp, pid),
            ]);
            yield categories.updateRecentTidForCid(postData.cid);
            plugins.hooks.fire(`action:post.${type}`, { post: _.clone(postData), uid: uid });
            if (type === 'delete') {
                yield flags.resolveFlag('post', pid, uid);
            }
            return postData;
        });
    }
    Posts.purge = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            pids = Array.isArray(pids) ? pids : [pids];
            let postData = yield Posts.getPostsData(pids);
            pids = pids.filter((pid, index) => !!postData[index]);
            postData = postData.filter(Boolean);
            if (!postData.length) {
                return;
            }
            const uniqTids = _.uniq(postData.map(p => p.tid));
            const topicData = yield topics.getTopicsFields(uniqTids, ['tid', 'cid', 'pinned', 'postcount']);
            const tidToTopic = _.zipObject(uniqTids, topicData);
            postData.forEach((p) => {
                p.topic = tidToTopic[p.tid];
                p.cid = tidToTopic[p.tid] && tidToTopic[p.tid].cid;
            });
            // deprecated hook
            yield Promise.all(postData.map(p => plugins.hooks.fire('filter:post.purge', { post: p, pid: p.pid, uid: uid })));
            // new hook
            yield plugins.hooks.fire('filter:posts.purge', {
                posts: postData,
                pids: postData.map(p => p.pid),
                uid: uid,
            });
            yield Promise.all([
                deleteFromTopicUserNotification(postData),
                deleteFromCategoryRecentPosts(postData),
                deleteFromUsersBookmarks(pids),
                deleteFromUsersVotes(pids),
                deleteFromReplies(postData),
                deleteFromGroups(pids),
                deleteDiffs(pids),
                deleteFromUploads(pids),
                db.sortedSetsRemove(['posts:pid', 'posts:votes', 'posts:flagged'], pids),
            ]);
            yield resolveFlags(postData, uid);
            // deprecated hook
            Promise.all(postData.map(p => plugins.hooks.fire('action:post.purge', { post: p, uid: uid })));
            // new hook
            plugins.hooks.fire('action:posts.purge', { posts: postData, uid: uid });
            yield db.deleteAll(postData.map(p => `post:${p.pid}`));
        });
    };
    function deleteFromTopicUserNotification(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const bulkRemove = [];
            postData.forEach((p) => {
                bulkRemove.push([`tid:${p.tid}:posts`, p.pid]);
                bulkRemove.push([`tid:${p.tid}:posts:votes`, p.pid]);
                bulkRemove.push([`uid:${p.uid}:posts`, p.pid]);
                bulkRemove.push([`cid:${p.cid}:uid:${p.uid}:pids`, p.pid]);
                bulkRemove.push([`cid:${p.cid}:uid:${p.uid}:pids:votes`, p.pid]);
            });
            yield db.sortedSetRemoveBulk(bulkRemove);
            const incrObjectBulk = [['global', { postCount: -postData.length }]];
            const postsByCategory = _.groupBy(postData, p => parseInt(p.cid, 10));
            for (const [cid, posts] of Object.entries(postsByCategory)) {
                incrObjectBulk.push([`category:${cid}`, { post_count: -posts.length }]);
            }
            const postsByTopic = _.groupBy(postData, p => parseInt(p.tid, 10));
            const topicPostCountTasks = [];
            const topicTasks = [];
            const zsetIncrBulk = [];
            for (const [tid, posts] of Object.entries(postsByTopic)) {
                incrObjectBulk.push([`topic:${tid}`, { postcount: -posts.length }]);
                if (posts.length && posts[0]) {
                    const topicData = posts[0].topic;
                    const newPostCount = topicData.postcount - posts.length;
                    topicPostCountTasks.push(['topics:posts', newPostCount, tid]);
                    if (!topicData.pinned) {
                        zsetIncrBulk.push([`cid:${topicData.cid}:tids:posts`, -posts.length, tid]);
                    }
                }
                topicTasks.push(topics.updateTeaser(tid));
                topicTasks.push(topics.updateLastPostTimeFromLastPid(tid));
                const postsByUid = _.groupBy(posts, p => parseInt(p.uid, 10));
                for (const [uid, uidPosts] of Object.entries(postsByUid)) {
                    zsetIncrBulk.push([`tid:${tid}:posters`, -uidPosts.length, uid]);
                }
                topicTasks.push(db.sortedSetIncrByBulk(zsetIncrBulk));
            }
            yield Promise.all([
                db.incrObjectFieldByBulk(incrObjectBulk),
                db.sortedSetAddBulk(topicPostCountTasks),
                ...topicTasks,
                user_1.default.updatePostCount(_.uniq(postData.map(p => p.uid))),
                notifications.rescind(...postData.map(p => `new_post:tid:${p.tid}:pid:${p.pid}:uid:${p.uid}`)),
            ]);
        });
    }
    function deleteFromCategoryRecentPosts(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const uniqCids = _.uniq(postData.map(p => p.cid));
            const sets = uniqCids.map((cid) => `cid:${cid}:pids`);
            yield db.sortedSetRemove(sets, postData.map(p => p.pid));
            yield Promise.all(uniqCids.map(categories.updateRecentTidForCid));
        });
    }
    function deleteFromUsersBookmarks(pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const arrayOfUids = yield db.getSetsMembers(pids.map(pid => `pid:${pid}:users_bookmarked`));
            const bulkRemove = [];
            pids.forEach((pid, index) => {
                arrayOfUids[index].forEach((uid) => {
                    bulkRemove.push([`uid:${uid}:bookmarks`, pid]);
                });
            });
            yield db.sortedSetRemoveBulk(bulkRemove);
            yield db.deleteAll(pids.map(pid => `pid:${pid}:users_bookmarked`));
        });
    }
    function deleteFromUsersVotes(pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const [upvoters, downvoters] = yield Promise.all([
                db.getSetsMembers(pids.map(pid => `pid:${pid}:upvote`)),
                db.getSetsMembers(pids.map(pid => `pid:${pid}:downvote`)),
            ]);
            const bulkRemove = [];
            pids.forEach((pid, index) => {
                upvoters[index].forEach((upvoterUid) => {
                    bulkRemove.push([`uid:${upvoterUid}:upvote`, pid]);
                });
                downvoters[index].forEach((downvoterUid) => {
                    bulkRemove.push([`uid:${downvoterUid}:downvote`, pid]);
                });
            });
            yield Promise.all([
                db.sortedSetRemoveBulk(bulkRemove),
                db.deleteAll([
                    ...pids.map(pid => `pid:${pid}:upvote`),
                    ...pids.map(pid => `pid:${pid}:downvote`),
                ]),
            ]);
        });
    }
    function deleteFromReplies(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const arrayOfReplyPids = yield db.getSortedSetsMembers(postData.map(p => `pid:${p.pid}:replies`));
            const allReplyPids = _.flatten(arrayOfReplyPids);
            const promises = [
                db.deleteObjectFields(allReplyPids.map(pid => `post:${pid}`), ['toPid']),
                db.deleteAll(postData.map(p => `pid:${p.pid}:replies`)),
            ];
            const postsWithParents = postData.filter(p => parseInt(p.toPid, 10));
            const bulkRemove = postsWithParents.map(p => [`pid:${p.toPid}:replies`, p.pid]);
            promises.push(db.sortedSetRemoveBulk(bulkRemove));
            yield Promise.all(promises);
            const parentPids = _.uniq(postsWithParents.map(p => p.toPid));
            const counts = db.sortedSetsCard(parentPids.map(pid => `pid:${pid}:replies`));
            yield db.setObjectBulk(parentPids.map((pid, index) => [`post:${pid}`, { replies: counts[index] }]));
        });
    }
    function deleteFromGroups(pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupNames = yield db.getSortedSetMembers('groups:visible:createtime');
            const keys = groupNames.map(groupName => `group:${groupName}:member:pids`);
            yield db.sortedSetRemove(keys, pids);
        });
    }
    function deleteDiffs(pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamps = yield Promise.all(pids.map(pid => Posts.diffs.list(pid)));
            yield db.deleteAll([
                ...pids.map(pid => `post:${pid}:diffs`),
                ..._.flattenDeep(pids.map((pid, index) => timestamps[index].map((t) => `diff:${pid}.${t}`))),
            ]);
        });
    }
    function deleteFromUploads(pids) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(pids.map(Posts.uploads.dissociateAll));
        });
    }
    function resolveFlags(postData, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const flaggedPosts = postData.filter(p => parseInt(p.flagId, 10));
            yield Promise.all(flaggedPosts.map(p => flags.update(p.flagId, uid, { state: 'resolved' })));
        });
    }
}
exports.default = default_1;
;
