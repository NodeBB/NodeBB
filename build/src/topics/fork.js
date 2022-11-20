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
const posts = require('../posts');
const categories = require('../categories');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
function default_1(Topics) {
    Topics.createTopicFromPosts = function (uid, title, pids, fromTid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (title) {
                title = title.trim();
            }
            if (title.length < meta_1.default.config.minimumTitleLength) {
                throw new Error(`[[error:title-too-short, ${meta_1.default.config.minimumTitleLength}]]`);
            }
            else if (title.length > meta_1.default.config.maximumTitleLength) {
                throw new Error(`[[error:title-too-long, ${meta_1.default.config.maximumTitleLength}]]`);
            }
            if (!pids || !pids.length) {
                throw new Error('[[error:invalid-pid]]');
            }
            pids.sort((a, b) => a - b);
            const mainPid = pids[0];
            const cid = yield posts.getCidByPid(mainPid);
            const [postData, isAdminOrMod] = yield Promise.all([
                posts.getPostData(mainPid),
                privileges.categories.isAdminOrMod(cid, uid),
            ]);
            if (!isAdminOrMod) {
                throw new Error('[[error:no-privileges]]');
            }
            const scheduled = postData.timestamp > Date.now();
            const params = {
                uid: postData.uid,
                title: title,
                cid: cid,
                timestamp: scheduled && postData.timestamp,
            };
            const result = yield plugins.hooks.fire('filter:topic.fork', {
                params: params,
                tid: postData.tid,
            });
            const tid = yield Topics.create(result.params);
            yield Topics.updateTopicBookmarks(fromTid, pids);
            for (const pid of pids) {
                /* eslint-disable no-await-in-loop */
                const canEdit = yield privileges.posts.canEdit(pid, uid);
                if (!canEdit.flag) {
                    throw new Error(canEdit.message);
                }
                yield Topics.movePostToTopic(uid, pid, tid, scheduled);
            }
            yield Topics.updateLastPostTime(tid, scheduled ? (postData.timestamp + 1) : Date.now());
            yield Promise.all([
                Topics.setTopicFields(tid, {
                    upvotes: postData.upvotes,
                    downvotes: postData.downvotes,
                }),
                database_1.default.sortedSetsAdd(['topics:votes', `cid:${cid}:tids:votes`], postData.votes, tid),
                Topics.events.log(fromTid, { type: 'fork', uid, href: `/topic/${tid}`, timestamp: postData.timestamp }),
            ]);
            plugins.hooks.fire('action:topic.fork', { tid: tid, fromTid: fromTid, uid: uid });
            return yield Topics.getTopicData(tid);
        });
    };
    Topics.movePostToTopic = function (callerUid, pid, tid, forceScheduled = false) {
        return __awaiter(this, void 0, void 0, function* () {
            tid = parseInt(tid, 10);
            const topicData = yield Topics.getTopicFields(tid, ['tid', 'scheduled']);
            if (!topicData.tid) {
                throw new Error('[[error:no-topic]]');
            }
            if (!forceScheduled && topicData.scheduled) {
                throw new Error('[[error:cant-move-posts-to-scheduled]]');
            }
            const postData = yield posts.getPostFields(pid, ['tid', 'uid', 'timestamp', 'upvotes', 'downvotes']);
            if (!postData || !postData.tid) {
                throw new Error('[[error:no-post]]');
            }
            const isSourceTopicScheduled = yield Topics.getTopicField(postData.tid, 'scheduled');
            if (!forceScheduled && isSourceTopicScheduled) {
                throw new Error('[[error:cant-move-from-scheduled-to-existing]]');
            }
            if (postData.tid === tid) {
                throw new Error('[[error:cant-move-to-same-topic]]');
            }
            postData.pid = pid;
            yield Topics.removePostFromTopic(postData.tid, postData);
            yield Promise.all([
                updateCategory(postData, tid),
                posts.setPostField(pid, 'tid', tid),
                Topics.addPostToTopic(tid, postData),
            ]);
            yield Promise.all([
                Topics.updateLastPostTimeFromLastPid(tid),
                Topics.updateLastPostTimeFromLastPid(postData.tid),
            ]);
            plugins.hooks.fire('action:post.move', { uid: callerUid, post: postData, tid: tid });
        });
    };
    function updateCategory(postData, toTid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicsFields([postData.tid, toTid], ['cid', 'pinned']);
            if (!topicData[0].cid || !topicData[1].cid) {
                return;
            }
            if (!topicData[0].pinned) {
                yield database_1.default.sortedSetIncrBy(`cid:${topicData[0].cid}:tids:posts`, -1, postData.tid);
            }
            if (!topicData[1].pinned) {
                yield database_1.default.sortedSetIncrBy(`cid:${topicData[1].cid}:tids:posts`, 1, toTid);
            }
            if (topicData[0].cid === topicData[1].cid) {
                yield categories.updateRecentTidForCid(topicData[0].cid);
                return;
            }
            const removeFrom = [
                `cid:${topicData[0].cid}:pids`,
                `cid:${topicData[0].cid}:uid:${postData.uid}:pids`,
                `cid:${topicData[0].cid}:uid:${postData.uid}:pids:votes`,
            ];
            const tasks = [
                database_1.default.incrObjectFieldBy(`category:${topicData[0].cid}`, 'post_count', -1),
                database_1.default.incrObjectFieldBy(`category:${topicData[1].cid}`, 'post_count', 1),
                database_1.default.sortedSetRemove(removeFrom, postData.pid),
                database_1.default.sortedSetAdd(`cid:${topicData[1].cid}:pids`, postData.timestamp, postData.pid),
                database_1.default.sortedSetAdd(`cid:${topicData[1].cid}:uid:${postData.uid}:pids`, postData.timestamp, postData.pid),
            ];
            if (postData.votes > 0 || postData.votes < 0) {
                tasks.push(database_1.default.sortedSetAdd(`cid:${topicData[1].cid}:uid:${postData.uid}:pids:votes`, postData.votes, postData.pid));
            }
            yield Promise.all(tasks);
            yield Promise.all([
                categories.updateRecentTidForCid(topicData[0].cid),
                categories.updateRecentTidForCid(topicData[1].cid),
            ]);
        });
    }
}
exports.default = default_1;
;
