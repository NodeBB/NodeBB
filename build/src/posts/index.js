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
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const plugins = require('../plugins');
const Posts = {};
require('./data').default(Posts);
require('./create').default(Posts);
require('./delete').default(Posts);
require('./edit').default(Posts);
require('./parse').default(Posts);
require('./user').default(Posts);
require('./topics').default(Posts);
require('./category').default(Posts);
require('./summary').default(Posts);
require('./recent').default(Posts);
require('./tools').default(Posts);
require('./votes').default(Posts);
require('./bookmarks').default(Posts);
require('./queue').default(Posts);
require('./diffs').default(Posts);
require('./uploads').default(Posts);
Posts.exists = function (pids) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield db.exists(Array.isArray(pids) ? pids.map(pid => `post:${pid}`) : `post:${pids}`);
    });
};
Posts.getPidsFromSet = function (set, start, stop, reverse) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isNaN(start) || isNaN(stop)) {
            return [];
        }
        return yield db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
    });
};
Posts.getPostsByPids = function (pids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        let posts = yield Posts.getPostsData(pids);
        posts = yield Promise.all(posts.map(Posts.parsePost));
        const data = yield plugins.hooks.fire('filter:post.getPosts', { posts: posts, uid: uid });
        if (!data || !Array.isArray(data.posts)) {
            return [];
        }
        return data.posts.filter(Boolean);
    });
};
Posts.getPostSummariesFromSet = function (set, uid, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        let pids = yield db.getSortedSetRevRange(set, start, stop);
        pids = yield privileges.posts.filter('topics:read', pids, uid);
        const posts = yield Posts.getPostSummaryByPids(pids, uid, { stripTags: false });
        return { posts: posts, nextStart: stop + 1 };
    });
};
Posts.getPidIndex = function (pid, tid, topicPostSort) {
    return __awaiter(this, void 0, void 0, function* () {
        const set = topicPostSort === 'most_votes' ? `tid:${tid}:posts:votes` : `tid:${tid}:posts`;
        const reverse = topicPostSort === 'newest_to_oldest' || topicPostSort === 'most_votes';
        const index = yield db[reverse ? 'sortedSetRevRank' : 'sortedSetRank'](set, pid);
        if (!utils.isNumber(index)) {
            return 0;
        }
        return utils.isNumber(index) ? parseInt(index, 10) + 1 : 0;
    });
};
Posts.getPostIndices = function (posts, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(posts) || !posts.length) {
            return [];
        }
        const settings = yield user_1.default.getSettings(uid);
        const byVotes = settings.topicPostSort === 'most_votes';
        let sets = posts.map(p => (byVotes ? `tid:${p.tid}:posts:votes` : `tid:${p.tid}:posts`));
        const reverse = settings.topicPostSort === 'newest_to_oldest' || settings.topicPostSort === 'most_votes';
        const uniqueSets = _.uniq(sets);
        let method = reverse ? 'sortedSetsRevRanks' : 'sortedSetsRanks';
        if (uniqueSets.length === 1) {
            method = reverse ? 'sortedSetRevRanks' : 'sortedSetRanks';
            sets = uniqueSets[0];
        }
        const pids = posts.map(post => post.pid);
        const indices = yield db[method](sets, pids);
        return indices.map(index => (utils.isNumber(index) ? parseInt(index, 10) + 1 : 0));
    });
};
Posts.modifyPostByPrivilege = function (post, privileges) {
    if (post && post.deleted && !(post.selfPost || privileges['posts:view_deleted'])) {
        post.content = '[[topic:post_is_deleted]]';
        if (post.user) {
            post.user.signature = '';
        }
    }
};
require('../promisify').promisify(Posts);
exports.default = Posts;
