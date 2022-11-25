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
const websockets = require('./index');
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const topics = require('../topics');
const categories = require('../categories');
const privileges = require('../privileges');
const notifications = require('../notifications');
const plugins = require('../plugins');
const utils = require('../utils');
const batch = require('../batch');
const SocketHelpers = {};
SocketHelpers.notifyNew = function (uid, type, result) {
    return __awaiter(this, void 0, void 0, function* () {
        let uids = yield user_1.default.getUidsFromSet('users:online', 0, -1);
        uids = uids.filter(toUid => parseInt(toUid, 10) !== uid);
        yield batch.processArray(uids, (uids) => __awaiter(this, void 0, void 0, function* () {
            yield notifyUids(uid, uids, type, result);
        }), {
            interval: 1000,
        });
    });
};
function notifyUids(uid, uids, type, result) {
    return __awaiter(this, void 0, void 0, function* () {
        const post = result.posts[0];
        const { tid } = post.topic;
        const { cid } = post.topic;
        uids = yield privileges.topics.filterUids('topics:read', tid, uids);
        const watchStateUids = uids;
        const watchStates = yield getWatchStates(watchStateUids, tid, cid);
        const categoryWatchStates = _.zipObject(watchStateUids, watchStates.categoryWatchStates);
        const topicFollowState = _.zipObject(watchStateUids, watchStates.topicFollowed);
        uids = filterTidCidIgnorers(watchStateUids, watchStates);
        uids = yield user_1.default.blocks.filterUids(uid, uids);
        uids = yield user_1.default.blocks.filterUids(post.topic.uid, uids);
        const data = yield plugins.hooks.fire('filter:sockets.sendNewPostToUids', {
            uidsTo: uids,
            uidFrom: uid,
            type: type,
            post: post,
        });
        post.ip = undefined;
        data.uidsTo.forEach((toUid) => {
            post.categoryWatchState = categoryWatchStates[toUid];
            post.topic.isFollowing = topicFollowState[toUid];
            websockets.in(`uid_${toUid}`).emit('event:new_post', result);
            if (result.topic && type === 'newTopic') {
                websockets.in(`uid_${toUid}`).emit('event:new_topic', result.topic);
            }
        });
    });
}
function getWatchStates(uids, tid, cid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            topicFollowed: db.isSetMembers(`tid:${tid}:followers`, uids),
            topicIgnored: db.isSetMembers(`tid:${tid}:ignorers`, uids),
            categoryWatchStates: categories.getUidsWatchStates(cid, uids),
        });
    });
}
function filterTidCidIgnorers(uids, watchStates) {
    return uids.filter((uid, index) => watchStates.topicFollowed[index] ||
        (!watchStates.topicIgnored[index] && watchStates.categoryWatchStates[index] !== categories.watchStates.ignoring));
}
SocketHelpers.sendNotificationToPostOwner = function (pid, fromuid, command, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!pid || !fromuid || !notification) {
            return;
        }
        fromuid = parseInt(fromuid, 10);
        const postData = yield posts.getPostFields(pid, ['tid', 'uid', 'content']);
        const [canRead, isIgnoring] = yield Promise.all([
            privileges.posts.can('topics:read', pid, postData.uid),
            topics.isIgnoring([postData.tid], postData.uid),
        ]);
        if (!canRead || isIgnoring[0] || !postData.uid || fromuid === postData.uid) {
            return;
        }
        const [userData, topicTitle, postObj] = yield Promise.all([
            user_1.default.getUserFields(fromuid, ['username']),
            topics.getTopicField(postData.tid, 'title'),
            posts.parsePost(postData),
        ]);
        const { displayname } = userData;
        const title = utils.decodeHTMLEntities(topicTitle);
        const titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
        const notifObj = yield notifications.create({
            type: command,
            bodyShort: `[[${notification}, ${displayname}, ${titleEscaped}]]`,
            bodyLong: postObj.content,
            pid: pid,
            tid: postData.tid,
            path: `/post/${pid}`,
            nid: `${command}:post:${pid}:uid:${fromuid}`,
            from: fromuid,
            mergeId: `${notification}|${pid}`,
            topicTitle: topicTitle,
        });
        notifications.push(notifObj, [postData.uid]);
    });
};
SocketHelpers.sendNotificationToTopicOwner = function (tid, fromuid, command, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tid || !fromuid || !notification) {
            return;
        }
        fromuid = parseInt(fromuid, 10);
        const [userData, topicData] = yield Promise.all([
            user_1.default.getUserFields(fromuid, ['username']),
            topics.getTopicFields(tid, ['uid', 'slug', 'title']),
        ]);
        if (fromuid === topicData.uid) {
            return;
        }
        const { displayname } = userData;
        const ownerUid = topicData.uid;
        const title = utils.decodeHTMLEntities(topicData.title);
        const titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
        const notifObj = yield notifications.create({
            bodyShort: `[[${notification}, ${displayname}, ${titleEscaped}]]`,
            path: `/topic/${topicData.slug}`,
            nid: `${command}:tid:${tid}:uid:${fromuid}`,
            from: fromuid,
        });
        if (ownerUid) {
            notifications.push(notifObj, [ownerUid]);
        }
    });
};
SocketHelpers.upvote = function (data, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.post || !data.post.uid || !data.post.votes || !data.post.pid || !data.fromuid) {
            return;
        }
        const { votes } = data.post;
        const touid = data.post.uid;
        const { fromuid } = data;
        const { pid } = data.post;
        const shouldNotify = {
            all: function () {
                return votes > 0;
            },
            first: function () {
                return votes === 1;
            },
            everyTen: function () {
                return votes > 0 && votes % 10 === 0;
            },
            threshold: function () {
                return [1, 5, 10, 25].includes(votes) || (votes >= 50 && votes % 50 === 0);
            },
            logarithmic: function () {
                return votes > 1 && Math.log10(votes) % 1 === 0;
            },
            disabled: function () {
                return false;
            },
        };
        const settings = yield user_1.default.getSettings(touid);
        const should = shouldNotify[settings.upvoteNotifFreq] || shouldNotify.all;
        if (should()) {
            SocketHelpers.sendNotificationToPostOwner(pid, fromuid, 'upvote', notification);
        }
    });
};
SocketHelpers.rescindUpvoteNotification = function (pid, fromuid) {
    return __awaiter(this, void 0, void 0, function* () {
        yield notifications.rescind(`upvote:post:${pid}:uid:${fromuid}`);
        const uid = yield posts.getPostField(pid, 'uid');
        const count = yield user_1.default.notifications.getUnreadCount(uid);
        websockets.in(`uid_${uid}`).emit('event:notifications.updateCount', count);
    });
};
SocketHelpers.emitToUids = function (event, data, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        uids.forEach(toUid => websockets.in(`uid_${toUid}`).emit(event, data));
    });
};
require('../promisify').promisify(SocketHelpers);
