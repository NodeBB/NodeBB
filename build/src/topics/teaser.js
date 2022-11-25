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
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const plugins = require('../plugins');
const utils = require('../utils');
function default_1(Topics) {
    Topics.getTeasers = function (topics, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(topics) || !topics.length) {
                return [];
            }
            let uid = options;
            let { teaserPost } = meta_1.default.config;
            if (typeof options === 'object') {
                uid = options.uid;
                teaserPost = options.teaserPost || meta_1.default.config.teaserPost;
            }
            const counts = [];
            const teaserPids = [];
            const tidToPost = {};
            topics.forEach((topic) => {
                counts.push(topic && topic.postcount);
                if (topic) {
                    if (topic.teaserPid === 'null') {
                        delete topic.teaserPid;
                    }
                    if (teaserPost === 'first') {
                        teaserPids.push(topic.mainPid);
                    }
                    else if (teaserPost === 'last-post') {
                        teaserPids.push(topic.teaserPid || topic.mainPid);
                    }
                    else { // last-reply and everything else uses teaserPid like `last` that was used before
                        teaserPids.push(topic.teaserPid);
                    }
                }
            });
            const [allPostData, callerSettings] = yield Promise.all([
                posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid', 'content']),
                user_1.default.getSettings(uid),
            ]);
            let postData = allPostData.filter((post) => post && post.pid);
            postData = yield handleBlocks(uid, postData);
            postData = postData.filter(Boolean);
            const uids = _.uniq(postData.map((post) => post.uid));
            const sortNewToOld = callerSettings.topicPostSort === 'newest_to_oldest';
            const usersData = yield user_1.default.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
            const users = {};
            usersData.forEach((user) => {
                users[user.uid] = user;
            });
            postData.forEach((post) => {
                // If the post author isn't represented in the retrieved users' data,
                // then it means they were deleted, assume guest.
                if (!users.hasOwnProperty(post.uid)) {
                    post.uid = 0;
                }
                post.user = users[post.uid];
                post.timestampISO = utils.toISOString(post.timestamp);
                tidToPost[post.tid] = post;
            });
            yield Promise.all(postData.map((p) => posts.parsePost(p)));
            const { tags } = yield plugins.hooks.fire('filter:teasers.configureStripTags', { tags: utils.stripTags.slice(0) });
            const teasers = topics.map((topic, index) => {
                if (!topic) {
                    return null;
                }
                if (tidToPost[topic.tid]) {
                    tidToPost[topic.tid].index = calcTeaserIndex(teaserPost, counts[index], sortNewToOld);
                    if (tidToPost[topic.tid].content) {
                        tidToPost[topic.tid].content = utils.stripHTMLTags(replaceImgWithAltText(tidToPost[topic.tid].content), tags);
                    }
                }
                return tidToPost[topic.tid];
            });
            const result = yield plugins.hooks.fire('filter:teasers.get', { teasers: teasers, uid: uid });
            return result.teasers;
        });
    };
    function calcTeaserIndex(teaserPost, postCountInTopic, sortNewToOld) {
        if (teaserPost === 'first') {
            return 1;
        }
        if (sortNewToOld) {
            return Math.min(2, postCountInTopic);
        }
        return postCountInTopic;
    }
    function replaceImgWithAltText(str) {
        return String(str).replace(/<img .*?alt="(.*?)"[^>]*>/gi, '$1');
    }
    function handleBlocks(uid, teasers) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockedUids = yield user_1.default.blocks.list(uid);
            if (!blockedUids.length) {
                return teasers;
            }
            return yield Promise.all(teasers.map((postData) => __awaiter(this, void 0, void 0, function* () {
                if (blockedUids.includes(parseInt(postData.uid, 10))) {
                    return yield getPreviousNonBlockedPost(postData, blockedUids);
                }
                return postData;
            })));
        });
    }
    function getPreviousNonBlockedPost(postData, blockedUids) {
        return __awaiter(this, void 0, void 0, function* () {
            let isBlocked = false;
            let prevPost = postData;
            const postsPerIteration = 5;
            let start = 0;
            let stop = start + postsPerIteration - 1;
            let checkedAllReplies = false;
            function checkBlocked(post) {
                const isPostBlocked = blockedUids.includes(parseInt(post.uid, 10));
                prevPost = !isPostBlocked ? post : prevPost;
                return isPostBlocked;
            }
            do {
                /* eslint-disable no-await-in-loop */
                let pids = yield db.getSortedSetRevRange(`tid:${postData.tid}:posts`, start, stop);
                if (!pids.length) {
                    checkedAllReplies = true;
                    const mainPid = yield Topics.getTopicField(postData.tid, 'mainPid');
                    pids = [mainPid];
                }
                const prevPosts = yield posts.getPostsFields(pids, ['pid', 'uid', 'timestamp', 'tid', 'content']);
                isBlocked = prevPosts.every(checkBlocked);
                start += postsPerIteration;
                stop = start + postsPerIteration - 1;
            } while (isBlocked && prevPost && prevPost.pid && !checkedAllReplies);
            return prevPost;
        });
    }
    Topics.getTeasersByTids = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || !tids.length) {
                return [];
            }
            const topics = yield Topics.getTopicsFields(tids, ['tid', 'postcount', 'teaserPid', 'mainPid']);
            return yield Topics.getTeasers(topics, uid);
        });
    };
    Topics.getTeaser = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const teasers = yield Topics.getTeasersByTids([tid], uid);
            return Array.isArray(teasers) && teasers.length ? teasers[0] : null;
        });
    };
    Topics.updateTeaser = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            let pid = yield Topics.getLatestUndeletedReply(tid);
            pid = pid || null;
            if (pid) {
                yield Topics.setTopicField(tid, 'teaserPid', pid);
            }
            else {
                yield Topics.deleteTopicField(tid, 'teaserPid');
            }
        });
    };
}
exports.default = default_1;
;
