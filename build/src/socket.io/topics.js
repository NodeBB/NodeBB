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
const posts = require('../posts');
const topics = require('../topics');
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const privileges = require('../privileges');
const cache = require('../cache');
const events = require('../events');
const SocketTopics = {};
require('./topics/unread').default(SocketTopics);
require('./topics/move').default(SocketTopics);
require('./topics/tools').default(SocketTopics);
require('./topics/infinitescroll').default(SocketTopics);
require('./topics/tags').default(SocketTopics);
require('./topics/merge').default(SocketTopics);
SocketTopics.postcount = function (socket, tid) {
    return __awaiter(this, void 0, void 0, function* () {
        const canRead = yield privileges.topics.can('topics:read', tid, socket.uid);
        if (!canRead) {
            throw new Error('[[no-privileges]]');
        }
        return yield topics.getTopicField(tid, 'postcount');
    });
};
SocketTopics.bookmark = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid || !data) {
            throw new Error('[[error:invalid-data]]');
        }
        const postcount = yield topics.getTopicField(data.tid, 'postcount');
        if (data.index > meta_1.default.config.bookmarkThreshold && postcount > meta_1.default.config.bookmarkThreshold) {
            yield topics.setUserBookmark(data.tid, socket.uid, data.index);
        }
    });
};
SocketTopics.createTopicFromPosts = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid) {
            throw new Error('[[error:not-logged-in]]');
        }
        if (!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
            throw new Error('[[error:invalid-data]]');
        }
        const result = yield topics.createTopicFromPosts(socket.uid, data.title, data.pids, data.fromTid);
        yield events.log({
            type: `topic-fork`,
            uid: socket.uid,
            ip: socket.ip,
            pids: String(data.pids),
            fromTid: data.fromTid,
            toTid: result.tid,
        });
        return result;
    });
};
SocketTopics.isFollowed = function (socket, tid) {
    return __awaiter(this, void 0, void 0, function* () {
        const isFollowing = yield topics.isFollowing([tid], socket.uid);
        return isFollowing[0];
    });
};
SocketTopics.isModerator = function (socket, tid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = yield topics.getTopicField(tid, 'cid');
        return yield user_1.default.isModerator(socket.uid, cid);
    });
};
SocketTopics.getMyNextPostIndex = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data || !data.tid || !data.index || !data.sort) {
            throw new Error('[[error:invalid-data]]');
        }
        function getTopicPids(index) {
            return __awaiter(this, void 0, void 0, function* () {
                const topicSet = data.sort === 'most_votes' ? `tid:${data.tid}:posts:votes` : `tid:${data.tid}:posts`;
                const reverse = data.sort === 'newest_to_oldest' || data.sort === 'most_votes';
                const cacheKey = `np:s:${topicSet}:r:${String(reverse)}:tid:${data.tid}:pids`;
                const topicPids = cache.get(cacheKey);
                if (topicPids) {
                    return topicPids.slice(index - 1);
                }
                const pids = yield db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](topicSet, 0, -1);
                cache.set(cacheKey, pids, 30000);
                return pids.slice(index - 1);
            });
        }
        function getUserPids() {
            return __awaiter(this, void 0, void 0, function* () {
                const cid = yield topics.getTopicField(data.tid, 'cid');
                const cacheKey = `np:cid:${cid}:uid:${socket.uid}:pids`;
                const userPids = cache.get(cacheKey);
                if (userPids) {
                    return userPids;
                }
                const pids = yield db.getSortedSetRange(`cid:${cid}:uid:${socket.uid}:pids`, 0, -1);
                cache.set(cacheKey, pids, 30000);
                return pids;
            });
        }
        const postCountInTopic = yield db.sortedSetScore(`tid:${data.tid}:posters`, socket.uid);
        if (postCountInTopic <= 0) {
            return 0;
        }
        const [topicPids, userPidsInCategory] = yield Promise.all([
            getTopicPids(data.index),
            getUserPids(),
        ]);
        const userPidsInTopic = _.intersection(topicPids, userPidsInCategory);
        if (!userPidsInTopic.length) {
            if (postCountInTopic > 0) {
                // wrap around to beginning
                const wrapIndex = yield SocketTopics.getMyNextPostIndex(socket, Object.assign(Object.assign({}, data), { index: 1 }));
                return wrapIndex;
            }
            return 0;
        }
        return yield posts.getPidIndex(userPidsInTopic[0], data.tid, data.sort);
    });
};
SocketTopics.getPostCountInTopic = function (socket, tid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!socket.uid || !tid) {
            return 0;
        }
        return yield db.sortedSetScore(`tid:${tid}:posters`, socket.uid);
    });
};
require('../promisify').promisify(SocketTopics);
