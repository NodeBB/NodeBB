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
const database = __importStar(require("./database"));
const db = database;
const posts = require('./posts');
const topics_1 = __importDefault(require("./topics"));
const categories = require('./categories');
const user = require('./user');
const plugins = require('./plugins');
const privileges = require('./privileges');
const utils = require('./utils');
const search = {};
search.search = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = process.hrtime();
        data.sortBy = data.sortBy || 'relevance';
        let result;
        if (data.searchIn === 'posts' || data.searchIn === 'titles' || data.searchIn === 'titlesposts') {
            result = yield searchInContent(data);
        }
        else if (data.searchIn === 'users') {
            result = yield user.search(data);
        }
        else if (data.searchIn === 'categories') {
            result = yield categories.search(data);
        }
        else if (data.searchIn === 'tags') {
            result = yield topics_1.default.searchAndLoadTags(data);
        }
        else if (data.searchIn) {
            result = yield plugins.hooks.fire('filter:search.searchIn', {
                data,
            });
        }
        else {
            throw new Error('[[error:unknown-search-filter]]');
        }
        result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
        return result;
    });
};
function searchInContent(data) {
    return __awaiter(this, void 0, void 0, function* () {
        data.uid = data.uid || 0;
        const [searchCids, searchUids] = yield Promise.all([
            getSearchCids(data),
            getSearchUids(data),
        ]);
        function doSearch(type, searchIn) {
            return __awaiter(this, void 0, void 0, function* () {
                if (searchIn.includes(data.searchIn)) {
                    const result = yield plugins.hooks.fire('filter:search.query', {
                        index: type,
                        content: data.query,
                        matchWords: data.matchWords || 'all',
                        cid: searchCids,
                        uid: searchUids,
                        searchData: data,
                        ids: [],
                    });
                    return Array.isArray(result) ? result : result.ids;
                }
                return [];
            });
        }
        let pids = [];
        let tids = [];
        const inTopic = String(data.query || '').match(/^in:topic-([\d]+) /);
        if (inTopic) {
            const tid = inTopic[1];
            const cleanedTerm = data.query.replace(inTopic[0], '');
            pids = yield topics_1.default.search(tid, cleanedTerm);
        }
        else {
            [pids, tids] = yield Promise.all([
                doSearch('post', ['posts', 'titlesposts']),
                doSearch('topic', ['titles', 'titlesposts']),
            ]);
        }
        const mainPids = yield topics_1.default.getMainPids(tids);
        let allPids = mainPids.concat(pids).filter(Boolean);
        allPids = yield privileges.posts.filter('topics:read', allPids, data.uid);
        allPids = yield filterAndSort(allPids, data);
        const metadata = yield plugins.hooks.fire('filter:search.inContent', {
            pids: allPids,
            data: data,
        });
        if (data.returnIds) {
            const mainPidsSet = new Set(mainPids);
            const mainPidToTid = _.zipObject(mainPids, tids);
            const pidsSet = new Set(pids);
            const returnPids = allPids.filter(pid => pidsSet.has(pid));
            const returnTids = allPids.filter(pid => mainPidsSet.has(pid)).map(pid => mainPidToTid[pid]);
            return { pids: returnPids, tids: returnTids };
        }
        const itemsPerPage = Math.min(data.itemsPerPage || 10, 100);
        const returnData = {
            posts: [],
            matchCount: metadata.pids.length,
            pageCount: Math.max(1, Math.ceil(parseInt(metadata.pids.length, 10) / itemsPerPage)),
        };
        if (data.page) {
            const start = Math.max(0, (data.page - 1)) * itemsPerPage;
            metadata.pids = metadata.pids.slice(start, start + itemsPerPage);
        }
        returnData.posts = yield posts.getPostSummaryByPids(metadata.pids, data.uid, {});
        yield plugins.hooks.fire('filter:search.contentGetResult', { result: returnData, data: data });
        delete metadata.pids;
        delete metadata.data;
        return Object.assign(returnData, metadata);
    });
}
function filterAndSort(pids, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data.sortBy === 'relevance' && !data.replies && !data.timeRange && !data.hasTags && !plugins.hooks.hasListeners('filter:search.filterAndSort')) {
            return pids;
        }
        let postsData = yield getMatchedPosts(pids, data);
        if (!postsData.length) {
            return pids;
        }
        postsData = postsData.filter(Boolean);
        postsData = filterByPostcount(postsData, data.replies, data.repliesFilter);
        postsData = filterByTimerange(postsData, data.timeRange, data.timeFilter);
        postsData = filterByTags(postsData, data.hasTags);
        sortPosts(postsData, data);
        const result = yield plugins.hooks.fire('filter:search.filterAndSort', { pids: pids, posts: postsData, data: data });
        return result.posts.map(post => post && post.pid);
    });
}
function getMatchedPosts(pids, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const postFields = ['pid', 'uid', 'tid', 'timestamp', 'deleted', 'upvotes', 'downvotes'];
        let postsData = yield posts.getPostsFields(pids, postFields);
        postsData = postsData.filter(post => post && !post.deleted);
        const uids = _.uniq(postsData.map(post => post.uid));
        const tids = _.uniq(postsData.map(post => post.tid));
        const [users, topics] = yield Promise.all([
            getUsers(uids, data),
            getTopics(tids, data),
        ]);
        const tidToTopic = _.zipObject(tids, topics);
        const uidToUser = _.zipObject(uids, users);
        postsData.forEach((post) => {
            if (topics && tidToTopic[post.tid]) {
                post.topic = tidToTopic[post.tid];
                if (post.topic && post.topic.category) {
                    post.category = post.topic.category;
                }
            }
            if (uidToUser[post.uid]) {
                post.user = uidToUser[post.uid];
            }
        });
        return postsData.filter(post => post && post.topic && !post.topic.deleted);
    });
}
function getUsers(uids, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data.sortBy.startsWith('user')) {
            return user.getUsersFields(uids, ['username']);
        }
        return [];
    });
}
function getTopics(tids, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const topicsData = yield topics_1.default.getTopicsData(tids);
        const cids = _.uniq(topicsData.map((topic) => topic && topic.cid));
        const categories = yield getCategories(cids, data);
        const cidToCategory = _.zipObject(cids, categories);
        topicsData.forEach((topic) => {
            if (topic && categories && cidToCategory[topic.cid]) {
                topic.category = cidToCategory[topic.cid];
            }
            if (topic && topic.tags) {
                topic.tags = topic.tags.map(tag => tag.value);
            }
        });
        return topicsData;
    });
}
function getCategories(cids, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const categoryFields = [];
        if (data.sortBy.startsWith('category.')) {
            categoryFields.push(data.sortBy.split('.')[1]);
        }
        if (!categoryFields.length) {
            return null;
        }
        return yield db.getObjectsFields(cids.map((cid) => `category:${cid}`), categoryFields);
    });
}
function filterByPostcount(posts, postCount, repliesFilter) {
    postCount = parseInt(postCount, 10);
    if (postCount) {
        if (repliesFilter === 'atleast') {
            posts = posts.filter(post => post.topic && post.topic.postcount >= postCount);
        }
        else {
            posts = posts.filter(post => post.topic && post.topic.postcount <= postCount);
        }
    }
    return posts;
}
function filterByTimerange(posts, timeRange, timeFilter) {
    timeRange = parseInt(timeRange, 10) * 1000;
    if (timeRange) {
        const time = Date.now() - timeRange;
        if (timeFilter === 'newer') {
            posts = posts.filter(post => post.timestamp >= time);
        }
        else {
            posts = posts.filter(post => post.timestamp <= time);
        }
    }
    return posts;
}
function filterByTags(posts, hasTags) {
    if (Array.isArray(hasTags) && hasTags.length) {
        posts = posts.filter((post) => {
            let hasAllTags = false;
            if (post && post.topic && Array.isArray(post.topic.tags) && post.topic.tags.length) {
                hasAllTags = hasTags.every(tag => post.topic.tags.includes(tag));
            }
            return hasAllTags;
        });
    }
    return posts;
}
function sortPosts(posts, data) {
    if (!posts.length || data.sortBy === 'relevance') {
        return;
    }
    data.sortDirection = data.sortDirection || 'desc';
    const direction = data.sortDirection === 'desc' ? 1 : -1;
    const fields = data.sortBy.split('.');
    if (fields.length === 1) {
        return posts.sort((p1, p2) => direction * (p2[fields[0]] - p1[fields[0]]));
    }
    const firstPost = posts[0];
    if (!fields || fields.length !== 2 || !firstPost[fields[0]] || !firstPost[fields[0]][fields[1]]) {
        return;
    }
    const isNumeric = utils.isNumber(firstPost[fields[0]][fields[1]]);
    if (isNumeric) {
        posts.sort((p1, p2) => direction * (p2[fields[0]][fields[1]] - p1[fields[0]][fields[1]]));
    }
    else {
        posts.sort((p1, p2) => {
            if (p1[fields[0]][fields[1]] > p2[fields[0]][fields[1]]) {
                return direction;
            }
            else if (p1[fields[0]][fields[1]] < p2[fields[0]][fields[1]]) {
                return -direction;
            }
            return 0;
        });
    }
}
function getSearchCids(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(data.categories) || !data.categories.length) {
            return [];
        }
        if (data.categories.includes('all')) {
            return yield categories.getCidsByPrivilege('categories:cid', data.uid, 'read');
        }
        const [watchedCids, childrenCids] = yield Promise.all([
            getWatchedCids(data),
            getChildrenCids(data),
        ]);
        return _.uniq(watchedCids.concat(childrenCids).concat(data.categories).filter(Boolean));
    });
}
function getWatchedCids(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.categories.includes('watched')) {
            return [];
        }
        return yield user.getWatchedCategories(data.uid);
    });
}
function getChildrenCids(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.searchChildren) {
            return [];
        }
        const childrenCids = yield Promise.all(data.categories.map((cid) => categories.getChildrenCids(cid)));
        return yield privileges.categories.filterCids('find', _.uniq(_.flatten(childrenCids)), data.uid);
    });
}
function getSearchUids(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.postedBy) {
            return [];
        }
        return yield user.getUidsByUsernames(Array.isArray(data.postedBy) ? data.postedBy : [data.postedBy]);
    });
}
require('./promisify').promisify(search);
