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
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const posts = require('../posts');
const topics = require('../topics');
const privileges = require('../privileges');
const plugins = require('../plugins');
const batch = require('../batch');
function default_1(Categories) {
    Categories.getRecentReplies = function (cid, uid, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            // backwards compatibility, treat start as count
            if (stop === undefined && start > 0) {
                winston_1.default.warn('[Categories.getRecentReplies] 3 params deprecated please use Categories.getRecentReplies(cid, uid, start, stop)');
                stop = start - 1;
                start = 0;
            }
            let pids = yield db.getSortedSetRevRange(`cid:${cid}:pids`, start, stop);
            pids = yield privileges.posts.filter('topics:read', pids, uid);
            return yield posts.getPostSummaryByPids(pids, uid, { stripTags: true });
        });
    };
    Categories.updateRecentTid = function (cid, tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [count, numRecentReplies] = yield Promise.all([
                db.sortedSetCard(`cid:${cid}:recent_tids`),
                db.getObjectField(`category:${cid}`, 'numRecentReplies'),
            ]);
            if (count >= numRecentReplies) {
                const data = yield db.getSortedSetRangeWithScores(`cid:${cid}:recent_tids`, 0, count - numRecentReplies);
                const shouldRemove = !(data.length === 1 && count === 1 && data[0].value === String(tid));
                if (data.length && shouldRemove) {
                    yield db.sortedSetsRemoveRangeByScore([`cid:${cid}:recent_tids`], '-inf', data[data.length - 1].score);
                }
            }
            if (numRecentReplies > 0) {
                yield db.sortedSetAdd(`cid:${cid}:recent_tids`, Date.now(), tid);
            }
            yield plugins.hooks.fire('action:categories.updateRecentTid', { cid: cid, tid: tid });
        });
    };
    Categories.updateRecentTidForCid = function (cid) {
        return __awaiter(this, void 0, void 0, function* () {
            let postData;
            let topicData;
            let index = 0;
            do {
                /* eslint-disable no-await-in-loop */
                const pids = yield db.getSortedSetRevRange(`cid:${cid}:pids`, index, index);
                if (!pids.length) {
                    return;
                }
                postData = yield posts.getPostFields(pids[0], ['tid', 'deleted']);
                if (postData && postData.tid && !postData.deleted) {
                    topicData = yield topics.getTopicData(postData.tid);
                }
                index += 1;
            } while (!topicData || topicData.deleted || topicData.scheduled);
            if (postData && postData.tid) {
                yield Categories.updateRecentTid(cid, postData.tid);
            }
        });
    };
    Categories.getRecentTopicReplies = function (categoryData, uid, query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(categoryData) || !categoryData.length) {
                return;
            }
            const categoriesToLoad = categoryData.filter(c => c && c.numRecentReplies && parseInt(c.numRecentReplies, 10) > 0);
            let keys = [];
            if (plugins.hooks.hasListeners('filter:categories.getRecentTopicReplies')) {
                const result = yield plugins.hooks.fire('filter:categories.getRecentTopicReplies', {
                    categories: categoriesToLoad,
                    uid: uid,
                    query: query,
                    keys: [],
                });
                keys = result.keys;
            }
            else {
                keys = categoriesToLoad.map(c => `cid:${c.cid}:recent_tids`);
            }
            const results = yield db.getSortedSetsMembers(keys);
            let tids = _.uniq(_.flatten(results).filter(Boolean));
            tids = yield privileges.topics.filterTids('topics:read', tids, uid);
            const topics = yield getTopics(tids, uid);
            assignTopicsToCategories(categoryData, topics);
            bubbleUpChildrenPosts(categoryData);
        });
    };
    function getTopics(tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield topics.getTopicsFields(tids, ['tid', 'mainPid', 'slug', 'title', 'teaserPid', 'cid', 'postcount']);
            topicData.forEach((topic) => {
                if (topic) {
                    topic.teaserPid = topic.teaserPid || topic.mainPid;
                }
            });
            const cids = _.uniq(topicData.map((t) => t && t.cid).filter((cid) => parseInt(cid, 10)));
            const getToRoot = () => __awaiter(this, void 0, void 0, function* () { return yield Promise.all(cids.map(Categories.getParentCids)); });
            const [toRoot, teasers] = yield Promise.all([
                getToRoot(),
                topics.getTeasers(topicData, uid),
            ]);
            const cidToRoot = _.zipObject(cids, toRoot);
            teasers.forEach((teaser, index) => {
                if (teaser) {
                    teaser.cid = topicData[index].cid;
                    teaser.parentCids = cidToRoot[teaser.cid];
                    teaser.tid = undefined;
                    teaser.uid = undefined;
                    teaser.topic = {
                        slug: topicData[index].slug,
                        title: topicData[index].title,
                    };
                }
            });
            return teasers.filter(Boolean);
        });
    }
    function assignTopicsToCategories(categories, topics) {
        categories.forEach((category) => {
            if (category) {
                category.posts = topics.filter((t) => t.cid && (t.cid === category.cid || t.parentCids.includes(category.cid)))
                    .sort((a, b) => b.pid - a.pid)
                    .slice(0, parseInt(category.numRecentReplies, 10));
            }
        });
        topics.forEach((t) => { t.parentCids = undefined; });
    }
    function bubbleUpChildrenPosts(categoryData) {
        categoryData.forEach((category) => {
            if (category) {
                if (category.posts.length) {
                    return;
                }
                const posts = [];
                getPostsRecursive(category, posts);
                posts.sort((a, b) => b.pid - a.pid);
                if (posts.length) {
                    category.posts = [posts[0]];
                }
            }
        });
    }
    function getPostsRecursive(category, posts) {
        if (Array.isArray(category.posts)) {
            category.posts.forEach(p => posts.push(p));
        }
        category.children.forEach(child => getPostsRecursive(child, posts));
    }
    // terrible name, should be topics.moveTopicPosts
    Categories.moveRecentReplies = function (tid, oldCid, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield updatePostCount(tid, oldCid, cid);
            const [pids, topicDeleted] = yield Promise.all([
                topics.getPids(tid),
                topics.getTopicField(tid, 'deleted'),
            ]);
            yield batch.processArray(pids, (pids) => __awaiter(this, void 0, void 0, function* () {
                const postData = yield posts.getPostsFields(pids, ['pid', 'deleted', 'uid', 'timestamp', 'upvotes', 'downvotes']);
                const bulkRemove = [];
                const bulkAdd = [];
                postData.forEach((post) => {
                    bulkRemove.push([`cid:${oldCid}:uid:${post.uid}:pids`, post.pid]);
                    bulkRemove.push([`cid:${oldCid}:uid:${post.uid}:pids:votes`, post.pid]);
                    bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids`, post.timestamp, post.pid]);
                    if (post.votes > 0 || post.votes < 0) {
                        bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids:votes`, post.votes, post.pid]);
                    }
                });
                const postsToReAdd = postData.filter(p => !p.deleted && !topicDeleted);
                const timestamps = postsToReAdd.map(p => p && p.timestamp);
                yield Promise.all([
                    db.sortedSetRemove(`cid:${oldCid}:pids`, pids),
                    db.sortedSetAdd(`cid:${cid}:pids`, timestamps, postsToReAdd.map(p => p.pid)),
                    db.sortedSetRemoveBulk(bulkRemove),
                    db.sortedSetAddBulk(bulkAdd),
                ]);
            }), { batch: 500 });
        });
    };
    function updatePostCount(tid, oldCid, newCid) {
        return __awaiter(this, void 0, void 0, function* () {
            const postCount = yield topics.getTopicField(tid, 'postcount');
            if (!postCount) {
                return;
            }
            yield Promise.all([
                db.incrObjectFieldBy(`category:${oldCid}`, 'post_count', -postCount),
                db.incrObjectFieldBy(`category:${newCid}`, 'post_count', postCount),
            ]);
        });
    }
}
exports.default = default_1;
;
