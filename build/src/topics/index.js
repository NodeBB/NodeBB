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
const validator = require('validator');
const database = __importStar(require("../database"));
const db = database;
const posts = require('../posts');
const utils = require('../utils');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const privileges = require('../privileges');
const social = require('../social');
const Topics = {};
require('./data').default(Topics);
require('./create').default(Topics);
require('./delete').default(Topics);
require('./sorted').default(Topics);
require('./unread').default(Topics);
require('./recent').default(Topics);
require('./user').default(Topics);
require('./fork').default(Topics);
require('./posts').default(Topics);
require('./follow').default(Topics);
require('./tags').default(Topics);
require('./teaser').default(Topics);
Topics.scheduled = require('./scheduled');
require('./suggested').default(Topics);
require('./tools').default(Topics);
Topics.thumbs = require('./thumbs');
require('./bookmarks').default(Topics);
require('./merge').default(Topics);
Topics.events = require('./events');
Topics.exists = function (tids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db.exists(Array.isArray(tids) ? tids.map(tid => `topic:${tid}`) : `topic:${tids}`);
    });
};
Topics.getTopicsFromSet = function (set, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        const tids = yield db.getSortedSetRevRange(set, start, stop);
        const topics = yield Topics.getTopics(tids, uid);
        Topics.calculateTopicIndices(topics, start);
        return { topics: topics, nextStart: stop + 1 };
    });
};
Topics.getTopics = function (tids, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let uid = options;
        if (typeof options === 'object') {
            uid = options.uid;
        }
        tids = yield privileges.topics.filterTids('topics:read', tids, uid);
        return yield Topics.getTopicsByTids(tids, options);
    });
};
Topics.getTopicsByTids = function (tids, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(tids) || !tids.length) {
            return [];
        }
        let uid = options;
        if (typeof options === 'object') {
            uid = options.uid;
        }
        function loadTopics() {
            return __awaiter(this, void 0, void 0, function* () {
                const topics = yield Topics.getTopicsData(tids);
                const uids = _.uniq(topics.map((t) => t && t.uid && t.uid.toString()).filter((v) => utils.isNumber(v)));
                const cids = _.uniq(topics.map((t) => t && t.cid && t.cid.toString()).filter((v) => utils.isNumber(v)));
                const guestTopics = topics.filter((t) => t && t.uid === 0);
                function loadGuestHandles() {
                    return __awaiter(this, void 0, void 0, function* () {
                        const mainPids = guestTopics.map((t) => t.mainPid);
                        const postData = yield posts.getPostsFields(mainPids, ['handle']);
                        return postData.map((p) => p.handle);
                    });
                }
                function loadShowfullnameSettings() {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (meta_1.default.config.hideFullname) {
                            return uids.map(() => ({ showfullname: false }));
                        }
                        const data = yield db.getObjectsFields(uids.map((uid) => `user:${uid}:settings`), ['showfullname']);
                        data.forEach((setting) => {
                            setting.showfullname = parseInt(setting.showfullname, 10) === 1;
                        });
                        return data;
                    });
                }
                const [teasers, users, userSettings, categoriesData, guestHandles, thumbs] = yield Promise.all([
                    Topics.getTeasers(topics, options),
                    user_1.default.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status']),
                    loadShowfullnameSettings(),
                    categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'backgroundImage', 'imageClass', 'bgColor', 'color', 'disabled']),
                    loadGuestHandles(),
                    Topics.thumbs.load(topics),
                ]);
                users.forEach((userObj, idx) => {
                    // Hide fullname if needed
                    if (!userSettings[idx].showfullname) {
                        userObj.fullname = undefined;
                    }
                });
                return {
                    topics,
                    teasers,
                    usersMap: _.zipObject(uids, users),
                    categoriesMap: _.zipObject(cids, categoriesData),
                    tidToGuestHandle: _.zipObject(guestTopics.map((t) => t.tid), guestHandles),
                    thumbs,
                };
            });
        }
        const [result, hasRead, isIgnored, bookmarks, callerSettings] = yield Promise.all([
            loadTopics(),
            Topics.hasReadTopics(tids, uid),
            Topics.isIgnoring(tids, uid),
            Topics.getUserBookmarks(tids, uid),
            user_1.default.getSettings(uid),
        ]);
        const sortNewToOld = callerSettings.topicPostSort === 'newest_to_oldest';
        result.topics.forEach((topic, i) => {
            if (topic) {
                topic.thumbs = result.thumbs[i];
                topic.category = result.categoriesMap[topic.cid];
                topic.user = topic.uid ? result.usersMap[topic.uid] : Object.assign({}, result.usersMap[topic.uid]);
                if (result.tidToGuestHandle[topic.tid]) {
                    topic.user.username = validator.escape(result.tidToGuestHandle[topic.tid]);
                    topic.user.displayname = topic.user.username;
                }
                topic.teaser = result.teasers[i] || null;
                topic.isOwner = topic.uid === parseInt(uid, 10);
                topic.ignored = isIgnored[i];
                topic.unread = parseInt(uid, 10) <= 0 || (!hasRead[i] && !isIgnored[i]);
                topic.bookmark = sortNewToOld ?
                    Math.max(1, topic.postcount + 2 - bookmarks[i]) :
                    Math.min(topic.postcount, bookmarks[i] + 1);
                topic.unreplied = !topic.teaser;
                topic.icons = [];
            }
        });
        const filteredTopics = result.topics.filter((topic) => topic && topic.category && !topic.category.disabled);
        const hookResult = yield plugins.hooks.fire('filter:topics.get', { topics: filteredTopics, uid: uid });
        return hookResult.topics;
    });
};
Topics.getTopicWithPosts = function (topicData, set, uid, start, stop, reverse) {
    return __awaiter(this, void 0, void 0, function* () {
        const [posts, category, tagWhitelist, threadTools, followData, bookmark, postSharing, deleter, merger, related, thumbs, events,] = yield Promise.all([
            Topics.getTopicPosts(topicData, set, start, stop, uid, reverse),
            categories.getCategoryData(topicData.cid),
            categories.getTagWhitelist([topicData.cid]),
            plugins.hooks.fire('filter:topic.thread_tools', { topic: topicData, uid: uid, tools: [] }),
            Topics.getFollowData([topicData.tid], uid),
            Topics.getUserBookmark(topicData.tid, uid),
            social.getActivePostSharing(),
            getDeleter(topicData),
            getMerger(topicData),
            Topics.getRelatedTopics(topicData, uid),
            Topics.thumbs.load([topicData]),
            Topics.events.get(topicData.tid, uid, reverse),
        ]);
        topicData.thumbs = thumbs[0];
        topicData.posts = posts;
        topicData.events = events;
        topicData.posts.forEach((p) => {
            p.events = events.filter((event) => event.timestamp >= p.eventStart && event.timestamp < p.eventEnd);
            p.eventStart = undefined;
            p.eventEnd = undefined;
        });
        topicData.category = category;
        topicData.tagWhitelist = tagWhitelist[0];
        topicData.minTags = category.minTags;
        topicData.maxTags = category.maxTags;
        topicData.thread_tools = threadTools.tools;
        topicData.isFollowing = followData[0].following;
        topicData.isNotFollowing = !followData[0].following && !followData[0].ignoring;
        topicData.isIgnoring = followData[0].ignoring;
        topicData.bookmark = bookmark;
        topicData.postSharing = postSharing;
        topicData.deleter = deleter;
        if (deleter) {
            topicData.deletedTimestampISO = utils.toISOString(topicData.deletedTimestamp);
        }
        topicData.merger = merger;
        if (merger) {
            topicData.mergedTimestampISO = utils.toISOString(topicData.mergedTimestamp);
        }
        topicData.related = related || [];
        topicData.unreplied = topicData.postcount === 1;
        topicData.icons = [];
        const result = yield plugins.hooks.fire('filter:topic.get', { topic: topicData, uid: uid });
        return result.topic;
    });
};
function getDeleter(topicData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!parseInt(topicData.deleterUid, 10)) {
            return null;
        }
        return yield user_1.default.getUserFields(topicData.deleterUid, ['username', 'userslug', 'picture']);
    });
}
function getMerger(topicData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!parseInt(topicData.mergerUid, 10)) {
            return null;
        }
        const [merger, mergedIntoTitle,] = yield Promise.all([
            user_1.default.getUserFields(topicData.mergerUid, ['username', 'userslug', 'picture']),
            Topics.getTopicField(topicData.mergeIntoTid, 'title'),
        ]);
        merger.mergedIntoTitle = mergedIntoTitle;
        return merger;
    });
}
Topics.getMainPost = function (tid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const mainPosts = yield Topics.getMainPosts([tid], uid);
        return Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null;
    });
};
Topics.getMainPids = function (tids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(tids) || !tids.length) {
            return [];
        }
        const topicData = yield Topics.getTopicsFields(tids, ['mainPid']);
        return topicData.map((topic) => topic && topic.mainPid);
    });
};
Topics.getMainPosts = function (tids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const mainPids = yield Topics.getMainPids(tids);
        return yield getMainPosts(mainPids, uid);
    });
};
function getMainPosts(mainPids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let postData = yield posts.getPostsByPids(mainPids, uid);
        postData = yield user_1.default.blocks.filter(uid, postData);
        postData.forEach((post) => {
            if (post) {
                post.index = 0;
            }
        });
        return yield Topics.addPostData(postData, uid);
    });
}
Topics.isLocked = function (tid) {
    return __awaiter(this, void 0, void 0, function* () {
        const locked = yield Topics.getTopicField(tid, 'locked');
        return locked === 1;
    });
};
Topics.search = function (tid, term) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tid || !term) {
            throw new Error('[[error:invalid-data]]');
        }
        const result = yield plugins.hooks.fire('filter:topic.search', {
            tid: tid,
            term: term,
            ids: [],
        });
        return Array.isArray(result) ? result : result.ids;
    });
};
require('../promisify').promisify(Topics);
exports.default = Topics;
