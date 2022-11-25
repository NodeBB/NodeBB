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
const validator = require('validator');
const database = __importStar(require("../database"));
const db = database;
const posts = require('../posts');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const notifications = require('../notifications');
const utils = require('../utils');
const events = require('../events');
const SocketPosts = {};
require('./posts/votes').default(SocketPosts);
require('./posts/tools').default(SocketPosts);
SocketPosts.getRawPost = function (socket, pid) {
    return __awaiter(this, void 0, void 0, function* () {
        const canRead = yield privileges.posts.can('topics:read', pid, socket.uid);
        if (!canRead) {
            throw new Error('[[error:no-privileges]]');
        }
        const postData = yield posts.getPostFields(pid, ['content', 'deleted']);
        if (postData.deleted) {
            throw new Error('[[error:no-post]]');
        }
        postData.pid = pid;
        const result = yield plugins.hooks.fire('filter:post.getRawPost', { uid: socket.uid, postData: postData });
        return result.postData.content;
    });
};
SocketPosts.getPostSummaryByIndex = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data.index < 0) {
            data.index = 0;
        }
        let pid;
        if (data.index === 0) {
            pid = yield topics.getTopicField(data.tid, 'mainPid');
        }
        else {
            pid = yield db.getSortedSetRange(`tid:${data.tid}:posts`, data.index - 1, data.index - 1);
        }
        pid = Array.isArray(pid) ? pid[0] : pid;
        if (!pid) {
            return 0;
        }
        const topicPrivileges = yield privileges.topics.get(data.tid, socket.uid);
        if (!topicPrivileges['topics:read']) {
            throw new Error('[[error:no-privileges]]');
        }
        const postsData = yield posts.getPostSummaryByPids([pid], socket.uid, { stripTags: false });
        posts.modifyPostByPrivilege(postsData[0], topicPrivileges);
        return postsData[0];
    });
};
SocketPosts.getPostSummaryByPid = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.pid) {
            throw new Error('[[error:invalid-data]]');
        }
        const { pid } = data;
        const tid = yield posts.getPostField(pid, 'tid');
        const topicPrivileges = yield privileges.topics.get(tid, socket.uid);
        if (!topicPrivileges['topics:read']) {
            throw new Error('[[error:no-privileges]]');
        }
        const postsData = yield posts.getPostSummaryByPids([pid], socket.uid, { stripTags: false });
        posts.modifyPostByPrivilege(postsData[0], topicPrivileges);
        return postsData[0];
    });
};
SocketPosts.getCategory = function (socket, pid) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield posts.getCidByPid(pid);
    });
};
SocketPosts.getPidIndex = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        return yield posts.getPidIndex(data.pid, data.tid, data.topicPostSort);
    });
};
SocketPosts.getReplies = function (socket, pid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!utils.isNumber(pid)) {
            throw new Error('[[error:invalid-data]]');
        }
        const { topicPostSort } = yield user_1.default.getSettings(socket.uid);
        const pids = yield posts.getPidsFromSet(`pid:${pid}:replies`, 0, -1, topicPostSort === 'newest_to_oldest');
        let [postData, postPrivileges] = yield Promise.all([
            posts.getPostsByPids(pids, socket.uid),
            privileges.posts.get(pids, socket.uid),
        ]);
        postData = yield topics.addPostData(postData, socket.uid);
        postData.forEach((postData, index) => posts.modifyPostByPrivilege(postData, postPrivileges[index]));
        postData = postData.filter((postData, index) => postData && postPrivileges[index].read);
        postData = yield user_1.default.blocks.filter(socket.uid, postData);
        return postData;
    });
};
SocketPosts.accept = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield canEditQueue(socket, data, 'accept');
        const result = yield posts.submitFromQueue(data.id);
        if (result && socket.uid !== parseInt(result.uid, 10)) {
            yield sendQueueNotification('post-queue-accepted', result.uid, `/post/${result.pid}`);
        }
        yield logQueueEvent(socket, result, 'accept');
    });
};
SocketPosts.reject = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield canEditQueue(socket, data, 'reject');
        const result = yield posts.removeFromQueue(data.id);
        if (result && socket.uid !== parseInt(result.uid, 10)) {
            yield sendQueueNotification('post-queue-rejected', result.uid, '/');
        }
        yield logQueueEvent(socket, result, 'reject');
    });
};
function logQueueEvent(socket, result, type) {
    return __awaiter(this, void 0, void 0, function* () {
        const eventData = {
            type: `post-queue-${result.type}-${type}`,
            uid: socket.uid,
            ip: socket.ip,
            content: result.data.content,
            targetUid: result.uid,
        };
        if (result.type === 'topic') {
            eventData.cid = result.data.cid;
            eventData.title = result.data.title;
        }
        else {
            eventData.tid = result.data.tid;
        }
        if (result.pid) {
            eventData.pid = result.pid;
        }
        yield events.log(eventData);
    });
}
SocketPosts.notify = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield canEditQueue(socket, data, 'notify');
        const result = yield posts.getFromQueue(data.id);
        if (result) {
            yield sendQueueNotification('post-queue-notify', result.uid, `/post-queue/${data.id}`, validator.escape(String(data.message)));
        }
    });
};
function canEditQueue(socket, data, action) {
    return __awaiter(this, void 0, void 0, function* () {
        const canEditQueue = yield posts.canEditQueue(socket.uid, data, action);
        if (!canEditQueue) {
            throw new Error('[[error:no-privileges]]');
        }
    });
}
function sendQueueNotification(type, targetUid, path, notificationText) {
    return __awaiter(this, void 0, void 0, function* () {
        const notifData = {
            type: type,
            nid: `${type}-${targetUid}-${path}`,
            bodyShort: notificationText ? `[[notifications:${type}, ${notificationText}]]` : `[[notifications:${type}]]`,
            path: path,
        };
        if (parseInt(meta_1.default.config.postQueueNotificationUid, 10) > 0) {
            notifData.from = meta_1.default.config.postQueueNotificationUid;
        }
        const notifObj = yield notifications.create(notifData);
        yield notifications.push(notifObj, [targetUid]);
    });
}
SocketPosts.editQueuedContent = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.id || (!data.content && !data.title && !data.cid)) {
            throw new Error('[[error:invalid-data]]');
        }
        yield posts.editQueuedContent(socket.uid, data);
        if (data.content) {
            return yield plugins.hooks.fire('filter:parse.post', { postData: data });
        }
        return { postData: data };
    });
};
require('../promisify').promisify(SocketPosts);
