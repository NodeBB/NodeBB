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
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const posts = require('../posts');
const meta_1 = __importDefault(require("../meta"));
const privileges = require('../privileges');
const apiHelpers = require('./helpers');
const { doTopicAction } = apiHelpers;
const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');
const topicsAPI = {};
topicsAPI.get = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userPrivileges, topic] = yield Promise.all([
            privileges.topics.get(data.tid, caller.uid),
            topics.getTopicData(data.tid),
        ]);
        if (!topic ||
            !userPrivileges.read ||
            !userPrivileges['topics:read'] ||
            !privileges.topics.canViewDeletedScheduled(topic, userPrivileges)) {
            return null;
        }
        return topic;
    });
};
topicsAPI.create = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const payload = Object.assign({}, data);
        payload.tags = payload.tags || [];
        apiHelpers.setDefaultPostData(caller, payload);
        const isScheduling = parseInt(data.timestamp, 10) > payload.timestamp;
        if (isScheduling) {
            if (yield privileges.categories.can('topics:schedule', data.cid, caller.uid)) {
                payload.timestamp = parseInt(data.timestamp, 10);
            }
            else {
                throw new Error('[[error:no-privileges]]');
            }
        }
        yield meta_1.default.blacklist.test(caller.ip);
        const shouldQueue = yield posts.shouldQueue(caller.uid, payload);
        if (shouldQueue) {
            return yield posts.addToQueue(payload);
        }
        const result = yield topics.post(payload);
        yield topics.thumbs.migrate(data.uuid, result.topicData.tid);
        socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
        socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
        socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
        return result.topicData;
    });
};
topicsAPI.reply = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.tid || (meta_1.default.config.minimumPostLength !== 0 && !data.content)) {
            throw new Error('[[error:invalid-data]]');
        }
        const payload = Object.assign({}, data);
        apiHelpers.setDefaultPostData(caller, payload);
        yield meta_1.default.blacklist.test(caller.ip);
        const shouldQueue = yield posts.shouldQueue(caller.uid, payload);
        if (shouldQueue) {
            return yield posts.addToQueue(payload);
        }
        const postData = yield topics.reply(payload); // postData seems to be a subset of postObj, refactor?
        const postObj = yield posts.getPostSummaryByPids([postData.pid], caller.uid, {});
        const result = {
            posts: [postData],
            'reputation:disabled': meta_1.default.config['reputation:disabled'] === 1,
            'downvote:disabled': meta_1.default.config['downvote:disabled'] === 1,
        };
        user_1.default.updateOnlineUsers(caller.uid);
        if (caller.uid) {
            socketHelpers.emitToUids('event:new_post', result, [caller.uid]);
        }
        else if (caller.uid === 0) {
            websockets.in('online_guests').emit('event:new_post', result);
        }
        socketHelpers.notifyNew(caller.uid, 'newPost', result);
        return postObj[0];
    });
};
topicsAPI.delete = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('delete', 'event:topic_deleted', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.restore = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('restore', 'event:topic_restored', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.purge = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('purge', 'event:topic_purged', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.pin = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('pin', 'event:topic_pinned', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.unpin = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('unpin', 'event:topic_unpinned', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.lock = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('lock', 'event:topic_locked', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.unlock = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield doTopicAction('unlock', 'event:topic_unlocked', caller, {
            tids: data.tids,
        });
    });
};
topicsAPI.follow = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield topics.follow(data.tid, caller.uid);
    });
};
topicsAPI.ignore = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield topics.ignore(data.tid, caller.uid);
    });
};
topicsAPI.unfollow = function (caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield topics.unfollow(data.tid, caller.uid);
    });
};
exports.default = topicsAPI;
