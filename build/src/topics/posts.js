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
const validator = require('validator');
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const utils = require('../utils');
const backlinkRegex = new RegExp(`(?:${nconf_1.default.get('url').replace('/', '\\/')}|\b|\\s)\\/topic\\/(\\d+).default(?:\\/\\w+)?`, 'g');
function default_1(Topics) {
    Topics.onNewPostMade = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Topics.updateLastPostTime(postData.tid, postData.timestamp);
            yield Topics.addPostToTopic(postData.tid, postData);
        });
    };
    Topics.getTopicPosts = function (topicData, set, start, stop, uid, reverse) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!topicData) {
                return [];
            }
            let repliesStart = start;
            let repliesStop = stop;
            if (stop > 0) {
                repliesStop -= 1;
                if (start > 0) {
                    repliesStart -= 1;
                }
            }
            let pids = [];
            if (start !== 0 || stop !== 0) {
                pids = yield posts.getPidsFromSet(set, repliesStart, repliesStop, reverse);
            }
            if (!pids.length && !topicData.mainPid) {
                return [];
            }
            if (topicData.mainPid && start === 0) {
                pids.unshift(topicData.mainPid);
            }
            let postData = yield posts.getPostsByPids(pids, uid);
            if (!postData.length) {
                return [];
            }
            let replies = postData;
            if (topicData.mainPid && start === 0) {
                postData[0].index = 0;
                replies = postData.slice(1);
            }
            Topics.calculatePostIndices(replies, repliesStart);
            yield addEventStartEnd(postData, set, reverse, topicData);
            const allPosts = postData.slice();
            postData = yield user_1.default.blocks.filter(uid, postData);
            if (allPosts.length !== postData.length) {
                const includedPids = new Set(postData.map((p) => p.pid));
                allPosts.reverse().forEach((p, index) => {
                    if (!includedPids.has(p.pid) && allPosts[index + 1] && !reverse) {
                        allPosts[index + 1].eventEnd = p.eventEnd;
                    }
                });
            }
            const result = yield plugins.hooks.fire('filter:topic.getPosts', {
                topic: topicData,
                uid: uid,
                posts: yield Topics.addPostData(postData, uid),
            });
            return result.posts;
        });
    };
    function addEventStartEnd(postData, set, reverse, topicData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!postData.length) {
                return;
            }
            postData.forEach((p, index) => {
                if (p && p.index === 0 && reverse) {
                    p.eventStart = topicData.lastposttime;
                    p.eventEnd = Date.now();
                }
                else if (p && postData[index + 1]) {
                    p.eventStart = reverse ? postData[index + 1].timestamp : p.timestamp;
                    p.eventEnd = reverse ? p.timestamp : postData[index + 1].timestamp;
                }
            });
            const lastPost = postData[postData.length - 1];
            if (lastPost) {
                lastPost.eventStart = reverse ? topicData.timestamp : lastPost.timestamp;
                lastPost.eventEnd = reverse ? lastPost.timestamp : Date.now();
                if (lastPost.index) {
                    const nextPost = yield database_1.default[reverse ? 'getSortedSetRevRangeWithScores' : 'getSortedSetRangeWithScores'](set, lastPost.index, lastPost.index);
                    if (reverse) {
                        lastPost.eventStart = nextPost.length ? nextPost[0].score : lastPost.eventStart;
                    }
                    else {
                        lastPost.eventEnd = nextPost.length ? nextPost[0].score : lastPost.eventEnd;
                    }
                }
            }
        });
    }
    Topics.addPostData = function (postData, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(postData) || !postData.length) {
                return [];
            }
            const pids = postData.map(post => post && post.pid);
            function getPostUserData(field, method) {
                return __awaiter(this, void 0, void 0, function* () {
                    const uids = _.uniq(postData.filter((p) => p && parseInt(p[field], 10) >= 0).map((p) => p[field]));
                    const userData = yield method(uids);
                    return _.zipObject(uids, userData);
                });
            }
            const [bookmarks, voteData, userData, editors, replies,] = yield Promise.all([
                posts.hasBookmarked(pids, uid),
                posts.getVoteStatusByPostIDs(pids, uid),
                getPostUserData('uid', (uids) => __awaiter(this, void 0, void 0, function* () { return yield posts.getUserInfoForPosts(uids, uid); })),
                getPostUserData('editor', (uids) => __awaiter(this, void 0, void 0, function* () { return yield user_1.default.getUsersFields(uids, ['uid', 'username', 'userslug']); })),
                getPostReplies(pids, uid),
                Topics.addParentPosts(postData),
            ]);
            postData.forEach((postObj, i) => {
                if (postObj) {
                    postObj.user = postObj.uid ? userData[postObj.uid] : Object.assign({}, userData[postObj.uid]);
                    postObj.editor = postObj.editor ? editors[postObj.editor] : null;
                    postObj.bookmarked = bookmarks[i];
                    postObj.upvoted = voteData.upvotes[i];
                    postObj.downvoted = voteData.downvotes[i];
                    postObj.votes = postObj.votes || 0;
                    postObj.replies = replies[i];
                    postObj.selfPost = parseInt(uid, 10) > 0 && parseInt(uid, 10) === postObj.uid;
                    // Username override for guests, if enabled
                    if (meta_1.default.config.allowGuestHandles && postObj.uid === 0 && postObj.handle) {
                        postObj.user.username = validator.escape(String(postObj.handle));
                        postObj.user.displayname = postObj.user.username;
                    }
                }
            });
            const result = yield plugins.hooks.fire('filter:topics.addPostData', {
                posts: postData,
                uid: uid,
            });
            return result.posts;
        });
    };
    Topics.modifyPostsByPrivilege = function (topicData, topicPrivileges) {
        const loggedIn = parseInt(topicPrivileges.uid, 10) > 0;
        topicData.posts.forEach((post) => {
            if (post) {
                post.topicOwnerPost = parseInt(topicData.uid, 10) === parseInt(post.uid, 10);
                post.display_edit_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:edit']);
                post.display_delete_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:delete']);
                post.display_moderator_tools = post.display_edit_tools || post.display_delete_tools;
                post.display_move_tools = topicPrivileges.isAdminOrMod && post.index !== 0;
                post.display_post_menu = topicPrivileges.isAdminOrMod ||
                    (post.selfPost && !topicData.locked && !post.deleted) ||
                    (post.selfPost && post.deleted && parseInt(post.deleterUid, 10) === parseInt(topicPrivileges.uid, 10)) ||
                    ((loggedIn || topicData.postSharing.length) && !post.deleted);
                post.ip = topicPrivileges.isAdminOrMod ? post.ip : undefined;
                posts.modifyPostByPrivilege(post, topicPrivileges);
            }
        });
    };
    Topics.addParentPosts = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            let parentPids = postData.map((postObj) => (postObj && postObj.hasOwnProperty('toPid') ? parseInt(postObj.toPid, 10) : null)).filter(Boolean);
            if (!parentPids.length) {
                return;
            }
            parentPids = _.uniq(parentPids);
            const parentPosts = yield posts.getPostsFields(parentPids, ['uid']);
            const parentUids = _.uniq(parentPosts.map((postObj) => postObj && postObj.uid));
            const userData = yield user_1.default.getUsersFields(parentUids, ['username']);
            const usersMap = {};
            userData.forEach((user) => {
                usersMap[user.uid] = user.username;
            });
            const parents = {};
            parentPosts.forEach((post, i) => {
                parents[parentPids[i]] = { username: usersMap[post.uid] };
            });
            postData.forEach((post) => {
                post.parent = parents[post.toPid];
            });
        });
    };
    Topics.calculatePostIndices = function (posts, start) {
        posts.forEach((post, index) => {
            if (post) {
                post.index = start + index + 1;
            }
        });
    };
    Topics.getLatestUndeletedPid = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const pid = yield Topics.getLatestUndeletedReply(tid);
            if (pid) {
                return pid;
            }
            const mainPid = yield Topics.getTopicField(tid, 'mainPid');
            const mainPost = yield posts.getPostFields(mainPid, ['pid', 'deleted']);
            return mainPost.pid && !mainPost.deleted ? mainPost.pid : null;
        });
    };
    Topics.getLatestUndeletedReply = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            let isDeleted = false;
            let index = 0;
            do {
                /* eslint-disable no-await-in-loop */
                const pids = yield database_1.default.getSortedSetRevRange(`tid:${tid}:posts`, index, index);
                if (!pids.length) {
                    return null;
                }
                isDeleted = yield posts.getPostField(pids[0], 'deleted');
                if (!isDeleted) {
                    return parseInt(pids[0], 10);
                }
                index += 1;
            } while (isDeleted);
        });
    };
    Topics.addPostToTopic = function (tid, postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const mainPid = yield Topics.getTopicField(tid, 'mainPid');
            if (!parseInt(mainPid, 10)) {
                yield Topics.setTopicField(tid, 'mainPid', postData.pid);
            }
            else {
                const upvotes = parseInt(postData.upvotes, 10) || 0;
                const downvotes = parseInt(postData.downvotes, 10) || 0;
                const votes = upvotes - downvotes;
                yield database_1.default.sortedSetsAdd([
                    `tid:${tid}:posts`, `tid:${tid}:posts:votes`,
                ], [postData.timestamp, votes], postData.pid);
            }
            yield Topics.increasePostCount(tid);
            yield database_1.default.sortedSetIncrBy(`tid:${tid}:posters`, 1, postData.uid);
            const posterCount = yield database_1.default.sortedSetCard(`tid:${tid}:posters`);
            yield Topics.setTopicField(tid, 'postercount', posterCount);
            yield Topics.updateTeaser(tid);
        });
    };
    Topics.removePostFromTopic = function (tid, postData) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.sortedSetsRemove([
                `tid:${tid}:posts`,
                `tid:${tid}:posts:votes`,
            ], postData.pid);
            yield Topics.decreasePostCount(tid);
            yield database_1.default.sortedSetIncrBy(`tid:${tid}:posters`, -1, postData.uid);
            yield database_1.default.sortedSetsRemoveRangeByScore([`tid:${tid}:posters`], '-inf', 0);
            const posterCount = yield database_1.default.sortedSetCard(`tid:${tid}:posters`);
            yield Topics.setTopicField(tid, 'postercount', posterCount);
            yield Topics.updateTeaser(tid);
        });
    };
    Topics.getPids = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            let [mainPid, pids] = yield Promise.all([
                Topics.getTopicField(tid, 'mainPid'),
                database_1.default.getSortedSetRange(`tid:${tid}:posts`, 0, -1),
            ]);
            if (parseInt(mainPid, 10)) {
                pids = [mainPid].concat(pids);
            }
            return pids;
        });
    };
    Topics.increasePostCount = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            incrementFieldAndUpdateSortedSet(tid, 'postcount', 1, 'topics:posts');
        });
    };
    Topics.decreasePostCount = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            incrementFieldAndUpdateSortedSet(tid, 'postcount', -1, 'topics:posts');
        });
    };
    Topics.increaseViewCount = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield Topics.getTopicField(tid, 'cid');
            incrementFieldAndUpdateSortedSet(tid, 'viewcount', 1, ['topics:views', `cid:${cid}:tids:views`]);
        });
    };
    function incrementFieldAndUpdateSortedSet(tid, field, by, set) {
        return __awaiter(this, void 0, void 0, function* () {
            const value = yield database_1.default.incrObjectFieldBy(`topic:${tid}`, field, by);
            yield database_1.default[Array.isArray(set) ? 'sortedSetsAdd' : 'sortedSetAdd'](set, value, tid);
        });
    }
    Topics.getTitleByPid = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Topics.getTopicFieldByPid('title', pid);
        });
    };
    Topics.getTopicFieldByPid = function (field, pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = yield posts.getPostField(pid, 'tid');
            return yield Topics.getTopicField(tid, field);
        });
    };
    Topics.getTopicDataByPid = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = yield posts.getPostField(pid, 'tid');
            return yield Topics.getTopicData(tid);
        });
    };
    Topics.getPostCount = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.default.getObjectField(`topic:${tid}`, 'postcount');
        });
    };
    function getPostReplies(pids, callerUid) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = pids.map(pid => `pid:${pid}:replies`);
            const arrayOfReplyPids = yield database_1.default.getSortedSetsMembers(keys);
            const uniquePids = _.uniq(_.flatten(arrayOfReplyPids));
            let replyData = yield posts.getPostsFields(uniquePids, ['pid', 'uid', 'timestamp']);
            const result = yield plugins.hooks.fire('filter:topics.getPostReplies', {
                uid: callerUid,
                replies: replyData,
            });
            replyData = yield user_1.default.blocks.filter(callerUid, result.replies);
            const uids = replyData.map((replyData) => replyData && replyData.uid);
            const uniqueUids = _.uniq(uids);
            const userData = yield user_1.default.getUsersWithFields(uniqueUids, ['uid', 'username', 'userslug', 'picture'], callerUid);
            const uidMap = _.zipObject(uniqueUids, userData);
            const pidMap = _.zipObject(replyData.map((r) => r.pid), replyData);
            const returnData = arrayOfReplyPids.map((replyPids) => {
                replyPids = replyPids.filter(pid => pidMap[pid]);
                const uidsUsed = {};
                const currentData = {
                    hasMore: false,
                    users: [],
                    text: replyPids.length > 1 ? `[[topic:replies_to_this_post, ${replyPids.length}]]` : '[[topic:one_reply_to_this_post]]',
                    count: replyPids.length,
                    timestampISO: replyPids.length ? utils.toISOString(pidMap[replyPids[0]].timestamp) : undefined,
                };
                replyPids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                replyPids.forEach((replyPid) => {
                    const replyData = pidMap[replyPid];
                    if (!uidsUsed[replyData.uid] && currentData.users.length < 6) {
                        currentData.users.push(uidMap[replyData.uid]);
                        uidsUsed[replyData.uid] = true;
                    }
                });
                if (currentData.users.length > 5) {
                    currentData.users.pop();
                    currentData.hasMore = true;
                }
                return currentData;
            });
            return returnData;
        });
    }
    Topics.syncBacklinks = (postData) => __awaiter(this, void 0, void 0, function* () {
        if (!postData) {
            throw new Error('[[error:invalid-data]]');
        }
        // Scan post content for topic links
        const matches = [...postData.content.matchAll(backlinkRegex)];
        if (!matches) {
            return 0;
        }
        const { pid, uid, tid } = postData;
        let add = _.uniq(matches.map(match => match[1]).map(tid => parseInt(tid, 10)));
        const now = Date.now();
        const topicsExist = yield Topics.exists(add);
        const current = (yield database_1.default.getSortedSetMembers(`pid:${pid}:backlinks`)).map((tid) => parseInt(tid, 10));
        const remove = current.filter((tid) => !add.includes(tid));
        add = add.filter((_tid, idx) => topicsExist[idx] && !current.includes(_tid) && tid !== _tid);
        // Remove old backlinks
        yield database_1.default.sortedSetRemove(`pid:${pid}:backlinks`, remove);
        // Add new backlinks
        yield database_1.default.sortedSetAdd(`pid:${pid}:backlinks`, add.map(() => now), add);
        yield Promise.all(add.map((tid) => __awaiter(this, void 0, void 0, function* () {
            yield Topics.events.log(tid, {
                uid,
                type: 'backlink',
                href: `/post/${pid}`,
            });
        })));
        return add.length + (current - remove);
    });
}
exports.default = default_1;
;
