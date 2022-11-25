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
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const analytics = require('../analytics');
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const posts = require('../posts');
const privileges = require('../privileges');
const categories = require('../categories');
const translator = require('../translator');
function default_1(Topics) {
    Topics.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            // This is an internal method, consider using Topics.post instead
            const timestamp = data.timestamp || Date.now();
            const tid = yield db.incrObjectField('global', 'nextTid');
            let topicData = {
                tid: tid,
                uid: data.uid,
                cid: data.cid,
                mainPid: 0,
                title: data.title,
                slug: `${tid}/${slugify(data.title) || 'topic'}`,
                timestamp: timestamp,
                lastposttime: 0,
                postcount: 0,
                viewcount: 0,
            };
            if (Array.isArray(data.tags) && data.tags.length) {
                topicData.tags = data.tags.join(',');
            }
            const result = yield plugins.hooks.fire('filter:topic.create', { topic: topicData, data: data });
            topicData = result.topic;
            yield db.setObject(`topic:${topicData.tid}`, topicData);
            const timestampedSortedSetKeys = [
                'topics:tid',
                `cid:${topicData.cid}:tids`,
                `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
            ];
            const scheduled = timestamp > Date.now();
            if (scheduled) {
                timestampedSortedSetKeys.push('topics:scheduled');
            }
            yield Promise.all([
                db.sortedSetsAdd(timestampedSortedSetKeys, timestamp, topicData.tid),
                db.sortedSetsAdd([
                    'topics:views', 'topics:posts', 'topics:votes',
                    `cid:${topicData.cid}:tids:votes`,
                    `cid:${topicData.cid}:tids:posts`,
                    `cid:${topicData.cid}:tids:views`,
                ], 0, topicData.tid),
                user_1.default.addTopicIdToUser(topicData.uid, topicData.tid, timestamp),
                db.incrObjectField(`category:${topicData.cid}`, 'topic_count'),
                db.incrObjectField('global', 'topicCount'),
                Topics.createTags(data.tags, topicData.tid, timestamp),
                scheduled ? Promise.resolve() : categories.updateRecentTid(topicData.cid, topicData.tid),
            ]);
            if (scheduled) {
                yield Topics.scheduled.pin(tid, topicData);
            }
            plugins.hooks.fire('action:topic.save', { topic: _.clone(topicData), data: data });
            return topicData.tid;
        });
    };
    Topics.post = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            data = yield plugins.hooks.fire('filter:topic.post', data);
            const { uid } = data;
            data.title = String(data.title).trim();
            data.tags = data.tags || [];
            if (data.content) {
                data.content = utils.rtrim(data.content);
            }
            Topics.checkTitle(data.title);
            yield Topics.validateTags(data.tags, data.cid, uid);
            data.tags = yield Topics.filterTags(data.tags, data.cid);
            if (!data.fromQueue) {
                Topics.checkContent(data.content);
            }
            const [categoryExists, canCreate, canTag] = yield Promise.all([
                categories.exists(data.cid),
                privileges.categories.can('topics:create', data.cid, uid),
                privileges.categories.can('topics:tag', data.cid, uid),
            ]);
            if (!categoryExists) {
                throw new Error('[[error:no-category]]');
            }
            if (!canCreate || (!canTag && data.tags.length)) {
                throw new Error('[[error:no-privileges]]');
            }
            yield guestHandleValid(data);
            if (!data.fromQueue) {
                yield user_1.default.isReadyToPost(uid, data.cid);
            }
            const tid = yield Topics.create(data);
            let postData = data;
            postData.tid = tid;
            postData.ip = data.req ? data.req.ip : null;
            postData.isMain = true;
            postData = yield posts.create(postData);
            postData = yield onNewPost(postData, data);
            const [settings, topics] = yield Promise.all([
                user_1.default.getSettings(uid),
                Topics.getTopicsByTids([postData.tid], uid),
            ]);
            if (!Array.isArray(topics) || !topics.length) {
                throw new Error('[[error:no-topic]]');
            }
            if (uid > 0 && settings.followTopicsOnCreate) {
                yield Topics.follow(postData.tid, uid);
            }
            const topicData = topics[0];
            topicData.unreplied = true;
            topicData.mainPost = postData;
            topicData.index = 0;
            postData.index = 0;
            if (topicData.scheduled) {
                yield Topics.delete(tid);
            }
            analytics.increment(['topics', `topics:byCid:${topicData.cid}`]);
            plugins.hooks.fire('action:topic.post', { topic: topicData, post: postData, data: data });
            if (parseInt(uid, 10) && !topicData.scheduled) {
                user_1.default.notifications.sendTopicNotificationToFollowers(uid, topicData, postData);
            }
            return {
                topicData: topicData,
                postData: postData,
            };
        });
    };
    Topics.reply = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            data = yield plugins.hooks.fire('filter:topic.reply', data);
            const { tid } = data;
            const { uid } = data;
            const topicData = yield Topics.getTopicData(tid);
            yield canReply(data, topicData);
            data.cid = topicData.cid;
            yield guestHandleValid(data);
            if (data.content) {
                data.content = utils.rtrim(data.content);
            }
            if (!data.fromQueue) {
                yield user_1.default.isReadyToPost(uid, data.cid);
                Topics.checkContent(data.content);
            }
            // For replies to scheduled topics, don't have a timestamp older than topic's itself
            if (topicData.scheduled) {
                data.timestamp = topicData.lastposttime + 1;
            }
            data.ip = data.req ? data.req.ip : null;
            let postData = yield posts.create(data);
            postData = yield onNewPost(postData, data);
            const settings = yield user_1.default.getSettings(uid);
            if (uid > 0 && settings.followTopicsOnReply) {
                yield Topics.follow(postData.tid, uid);
            }
            if (parseInt(uid, 10)) {
                user_1.default.setUserField(uid, 'lastonline', Date.now());
            }
            if (parseInt(uid, 10) || meta_1.default.config.allowGuestReplyNotifications) {
                const { displayname } = postData.user;
                Topics.notifyFollowers(postData, uid, {
                    type: 'new-reply',
                    bodyShort: translator.compile('notifications:user_posted_to', displayname, postData.topic.title),
                    nid: `new_post:tid:${postData.topic.tid}:pid:${postData.pid}:uid:${uid}`,
                    mergeId: `notifications:user_posted_to|${postData.topic.tid}`,
                });
            }
            analytics.increment(['posts', `posts:byCid:${data.cid}`]);
            plugins.hooks.fire('action:topic.reply', { post: _.clone(postData), data: data });
            return postData;
        });
    };
    function onNewPost(postData, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tid } = postData;
            const { uid } = postData;
            yield Topics.markAsUnreadForAll(tid);
            yield Topics.markAsRead([tid], uid);
            const [userInfo, topicInfo,] = yield Promise.all([
                posts.getUserInfoForPosts([postData.uid], uid),
                Topics.getTopicFields(tid, ['tid', 'uid', 'title', 'slug', 'cid', 'postcount', 'mainPid', 'scheduled']),
                Topics.addParentPosts([postData]),
                Topics.syncBacklinks(postData),
                posts.parsePost(postData),
            ]);
            postData.user = userInfo[0];
            postData.topic = topicInfo;
            postData.index = topicInfo.postcount - 1;
            posts.overrideGuestHandle(postData, data.handle);
            postData.votes = 0;
            postData.bookmarked = false;
            postData.display_edit_tools = true;
            postData.display_delete_tools = true;
            postData.display_moderator_tools = true;
            postData.display_move_tools = true;
            postData.selfPost = false;
            postData.timestampISO = utils.toISOString(postData.timestamp);
            postData.topic.title = String(postData.topic.title);
            return postData;
        });
    }
    Topics.checkTitle = function (title) {
        check(title, meta_1.default.config.minimumTitleLength, meta_1.default.config.maximumTitleLength, 'title-too-short', 'title-too-long');
    };
    Topics.checkContent = function (content) {
        check(content, meta_1.default.config.minimumPostLength, meta_1.default.config.maximumPostLength, 'content-too-short', 'content-too-long');
    };
    function check(item, min, max, minError, maxError) {
        // Trim and remove HTML (latter for composers that send in HTML, like redactor)
        if (typeof item === 'string') {
            item = utils.stripHTMLTags(item).trim();
        }
        if (item === null || item === undefined || item.length < parseInt(min, 10)) {
            throw new Error(`[[error:${minError}, ${min}]]`);
        }
        else if (item.length > parseInt(max, 10)) {
            throw new Error(`[[error:${maxError}, ${max}]]`);
        }
    }
    function guestHandleValid(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config.allowGuestHandles && parseInt(data.uid, 10) === 0 && data.handle) {
                if (data.handle.length > meta_1.default.config.maximumUsernameLength) {
                    throw new Error('[[error:guest-handle-invalid]]');
                }
                const exists = yield user_1.default.existsBySlug(slugify(data.handle));
                if (exists) {
                    throw new Error('[[error:username-taken]]');
                }
            }
        });
    }
    function canReply(data, topicData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!topicData) {
                throw new Error('[[error:no-topic]]');
            }
            const { tid, uid } = data;
            const { cid, deleted, locked, scheduled } = topicData;
            const [canReply, canSchedule, isAdminOrMod] = yield Promise.all([
                privileges.topics.can('topics:reply', tid, uid),
                privileges.topics.can('topics:schedule', tid, uid),
                privileges.categories.isAdminOrMod(cid, uid),
            ]);
            if (locked && !isAdminOrMod) {
                throw new Error('[[error:topic-locked]]');
            }
            if (!scheduled && deleted && !isAdminOrMod) {
                throw new Error('[[error:topic-deleted]]');
            }
            if (scheduled && !canSchedule) {
                throw new Error('[[error:no-privileges]]');
            }
            if (!canReply) {
                throw new Error('[[error:no-privileges]]');
            }
        });
    }
}
exports.default = default_1;
;
