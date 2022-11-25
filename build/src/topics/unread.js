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
const async = require('async');
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const notifications = require('../notifications');
const categories = require('../categories');
const privileges = require('../privileges');
const meta_1 = __importDefault(require("../meta"));
const utils = require('../utils');
const plugins = require('../plugins');
function default_1(Topics) {
    Topics.getTotalUnread = function (uid, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = filter || '';
            const counts = yield Topics.getUnreadTids({ cid: 0, uid: uid, count: true });
            return counts && counts[filter];
        });
    };
    Topics.getUnreadTopics = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const unreadTopics = {
                showSelect: true,
                nextStart: 0,
                topics: [],
            };
            let tids = yield Topics.getUnreadTids(params);
            unreadTopics.topicCount = tids.length;
            if (!tids.length) {
                return unreadTopics;
            }
            tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);
            const topicData = yield Topics.getTopicsByTids(tids, params.uid);
            if (!topicData.length) {
                return unreadTopics;
            }
            Topics.calculateTopicIndices(topicData, params.start);
            unreadTopics.topics = topicData;
            unreadTopics.nextStart = params.stop + 1;
            return unreadTopics;
        });
    };
    Topics.unreadCutoff = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const cutoff = Date.now() - (meta_1.default.config.unreadCutoff * 86400000);
            const data = yield plugins.hooks.fire('filter:topics.unreadCutoff', { uid: uid, cutoff: cutoff });
            return parseInt(data.cutoff, 10);
        });
    };
    Topics.getUnreadTids = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Topics.getUnreadData(params);
            return params.count ? results.counts : results.tids;
        });
    };
    Topics.getUnreadData = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uid = parseInt(params.uid, 10);
            params.filter = params.filter || '';
            if (params.cid && !Array.isArray(params.cid)) {
                params.cid = [params.cid];
            }
            const data = yield getTids(params);
            if (uid <= 0 || !data.tids || !data.tids.length) {
                return data;
            }
            const result = yield plugins.hooks.fire('filter:topics.getUnreadTids', {
                uid: uid,
                tids: data.tids,
                counts: data.counts,
                tidsByFilter: data.tidsByFilter,
                cid: params.cid,
                filter: params.filter,
                query: params.query || {},
            });
            return result;
        });
    };
    function getTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const counts = { '': 0, new: 0, watched: 0, unreplied: 0 };
            const tidsByFilter = { '': [], new: [], watched: [], unreplied: [] };
            if (params.uid <= 0) {
                return { counts: counts, tids: [], tidsByFilter: tidsByFilter };
            }
            params.cutoff = yield Topics.unreadCutoff(params.uid);
            const [followedTids, ignoredTids, categoryTids, userScores, tids_unread] = yield Promise.all([
                getFollowedTids(params),
                user_1.default.getIgnoredTids(params.uid, 0, -1),
                getCategoryTids(params),
                db.getSortedSetRevRangeByScoreWithScores(`uid:${params.uid}:tids_read`, 0, -1, '+inf', params.cutoff),
                db.getSortedSetRevRangeWithScores(`uid:${params.uid}:tids_unread`, 0, -1),
            ]);
            const userReadTimes = _.mapValues(_.keyBy(userScores, 'value'), 'score');
            const isTopicsFollowed = {};
            followedTids.forEach((t) => {
                isTopicsFollowed[t.value] = true;
            });
            const unreadFollowed = yield db.isSortedSetMembers(`uid:${params.uid}:followed_tids`, tids_unread.map((t) => t.value));
            tids_unread.forEach((t, i) => {
                isTopicsFollowed[t.value] = unreadFollowed[i];
            });
            const unreadTopics = _.unionWith(categoryTids, followedTids, (a, b) => a.value === b.value)
                .filter((t) => !ignoredTids.includes(t.value) && (!userReadTimes[t.value] || t.score > userReadTimes[t.value]))
                .concat(tids_unread.filter((t) => !ignoredTids.includes(t.value)))
                .sort((a, b) => b.score - a.score);
            let tids = _.uniq(unreadTopics.map((topic) => topic.value)).slice(0, 200);
            if (!tids.length) {
                return { counts: counts, tids: tids, tidsByFilter: tidsByFilter };
            }
            const blockedUids = yield user_1.default.blocks.list(params.uid);
            tids = yield filterTidsThatHaveBlockedPosts({
                uid: params.uid,
                tids: tids,
                blockedUids: blockedUids,
                recentTids: categoryTids,
            });
            tids = yield privileges.topics.filterTids('topics:read', tids, params.uid);
            const topicData = (yield Topics.getTopicsFields(tids, ['tid', 'cid', 'uid', 'postcount', 'deleted', 'scheduled']))
                .filter((t) => t.scheduled || !t.deleted);
            const topicCids = _.uniq(topicData.map((topic) => topic.cid)).filter(Boolean);
            const categoryWatchState = yield categories.getWatchState(topicCids, params.uid);
            const userCidState = _.zipObject(topicCids, categoryWatchState);
            const filterCids = params.cid && params.cid.map((cid) => parseInt(cid, 10));
            topicData.forEach((topic) => {
                if (topic && topic.cid && (!filterCids || filterCids.includes(topic.cid)) && !blockedUids.includes(topic.uid)) {
                    if (isTopicsFollowed[topic.tid] || userCidState[topic.cid] === categories.watchStates.watching) {
                        tidsByFilter[''].push(topic.tid);
                    }
                    if (isTopicsFollowed[topic.tid]) {
                        tidsByFilter.watched.push(topic.tid);
                    }
                    if (topic.postcount <= 1) {
                        tidsByFilter.unreplied.push(topic.tid);
                    }
                    if (!userReadTimes[topic.tid]) {
                        tidsByFilter.new.push(topic.tid);
                    }
                }
            });
            counts[''] = tidsByFilter[''].length;
            counts.watched = tidsByFilter.watched.length;
            counts.unreplied = tidsByFilter.unreplied.length;
            counts.new = tidsByFilter.new.length;
            return {
                counts: counts,
                tids: tidsByFilter[params.filter],
                tidsByFilter: tidsByFilter,
            };
        });
    }
    function getCategoryTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (plugins.hooks.hasListeners('filter:topics.unread.getCategoryTids')) {
                const result = yield plugins.hooks.fire('filter:topics.unread.getCategoryTids', { params: params, tids: [] });
                return result.tids;
            }
            if (params.filter === 'watched') {
                return [];
            }
            const cids = params.cid || (yield user_1.default.getWatchedCategories(params.uid));
            const keys = cids.map((cid) => `cid:${cid}:tids:lastposttime`);
            return yield db.getSortedSetRevRangeByScoreWithScores(keys, 0, -1, '+inf', params.cutoff);
        });
    }
    function getFollowedTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            let tids = yield db.getSortedSetMembers(`uid:${params.uid}:followed_tids`);
            const filterCids = params.cid && params.cid.map((cid) => parseInt(cid, 10));
            if (filterCids) {
                const topicData = yield Topics.getTopicsFields(tids, ['tid', 'cid']);
                tids = topicData.filter((t) => filterCids.includes(t.cid)).map((t) => t.tid);
            }
            const scores = yield db.sortedSetScores('topics:recent', tids);
            const data = tids.map((tid, index) => ({ value: String(tid), score: scores[index] }));
            return data.filter((item) => item.score > params.cutoff);
        });
    }
    function filterTidsThatHaveBlockedPosts(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!params.blockedUids.length) {
                return params.tids;
            }
            const topicScores = _.mapValues(_.keyBy(params.recentTids, 'value'), 'score');
            const results = yield db.sortedSetScores(`uid:${params.uid}:tids_read`, params.tids);
            const userScores = _.zipObject(params.tids, results);
            return yield async.filter(params.tids, (tid) => __awaiter(this, void 0, void 0, function* () {
                return yield doesTidHaveUnblockedUnreadPosts(tid, {
                    blockedUids: params.blockedUids,
                    topicTimestamp: topicScores[tid],
                    userLastReadTimestamp: userScores[tid],
                });
            }));
        });
    }
    function doesTidHaveUnblockedUnreadPosts(tid, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userLastReadTimestamp } = params;
            if (!userLastReadTimestamp) {
                return true;
            }
            let start = 0;
            const count = 3;
            let done = false;
            let hasUnblockedUnread = params.topicTimestamp > userLastReadTimestamp;
            if (!params.blockedUids.length) {
                return hasUnblockedUnread;
            }
            while (!done) {
                /* eslint-disable no-await-in-loop */
                const pidsSinceLastVisit = yield db.getSortedSetRangeByScore(`tid:${tid}:posts`, start, count, userLastReadTimestamp, '+inf');
                if (!pidsSinceLastVisit.length) {
                    return hasUnblockedUnread;
                }
                let postData = yield posts.getPostsFields(pidsSinceLastVisit, ['pid', 'uid']);
                postData = postData.filter((post) => !params.blockedUids.includes(parseInt(post.uid, 10)));
                done = postData.length > 0;
                hasUnblockedUnread = postData.length > 0;
                start += count;
            }
            return hasUnblockedUnread;
        });
    }
    Topics.pushUnreadCount = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uid || parseInt(uid, 10) <= 0) {
                return;
            }
            const results = yield Topics.getUnreadTids({ uid: uid, count: true });
            require('../socket.io').in(`uid_${uid}`).emit('event:unread.updateCount', {
                unreadTopicCount: results[''],
                unreadNewTopicCount: results.new,
                unreadWatchedTopicCount: results.watched,
                unreadUnrepliedTopicCount: results.unreplied,
            });
        });
    };
    Topics.markAsUnreadForAll = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Topics.markCategoryUnreadForAll(tid);
        });
    };
    Topics.markAsRead = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || !tids.length) {
                return false;
            }
            tids = _.uniq(tids).filter((tid) => tid && utils.isNumber(tid));
            if (!tids.length) {
                return false;
            }
            const [topicScores, userScores] = yield Promise.all([
                Topics.getTopicsFields(tids, ['tid', 'lastposttime', 'scheduled']),
                db.sortedSetScores(`uid:${uid}:tids_read`, tids),
            ]);
            const topics = topicScores.filter((t, i) => t.lastposttime && (!userScores[i] || userScores[i] < t.lastposttime));
            tids = topics.map((t) => t.tid);
            if (!tids.length) {
                return false;
            }
            const now = Date.now();
            const scores = topics.map((topic) => (topic.scheduled ? topic.lastposttime : now));
            const [topicData] = yield Promise.all([
                Topics.getTopicsFields(tids, ['cid']),
                db.sortedSetAdd(`uid:${uid}:tids_read`, scores, tids),
                db.sortedSetRemove(`uid:${uid}:tids_unread`, tids),
            ]);
            const cids = _.uniq(topicData.map((t) => t && t.cid).filter(Boolean));
            yield categories.markAsRead(cids, uid);
            plugins.hooks.fire('action:topics.markAsRead', { uid: uid, tids: tids });
            return true;
        });
    };
    Topics.markAllRead = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const cutoff = yield Topics.unreadCutoff(uid);
            const tids = yield db.getSortedSetRevRangeByScore('topics:recent', 0, -1, '+inf', cutoff);
            Topics.markTopicNotificationsRead(tids, uid);
            yield Topics.markAsRead(tids, uid);
            yield db.delete(`uid:${uid}:tids_unread`);
        });
    };
    Topics.markTopicNotificationsRead = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || !tids.length) {
                return;
            }
            const nids = yield user_1.default.notifications.getUnreadByField(uid, 'tid', tids);
            yield notifications.markReadMultiple(nids, uid);
            user_1.default.notifications.pushCount(uid);
        });
    };
    Topics.markCategoryUnreadForAll = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield Topics.getTopicField(tid, 'cid');
            yield categories.markAsUnreadForAll(cid);
        });
    };
    Topics.hasReadTopics = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(parseInt(uid, 10) > 0)) {
                return tids.map(() => false);
            }
            const [topicScores, userScores, tids_unread, blockedUids] = yield Promise.all([
                db.sortedSetScores('topics:recent', tids),
                db.sortedSetScores(`uid:${uid}:tids_read`, tids),
                db.sortedSetScores(`uid:${uid}:tids_unread`, tids),
                user_1.default.blocks.list(uid),
            ]);
            const cutoff = yield Topics.unreadCutoff(uid);
            const result = tids.map((tid, index) => {
                const read = !tids_unread[index] &&
                    (topicScores[index] < cutoff ||
                        !!(userScores[index] && userScores[index] >= topicScores[index]));
                return { tid: tid, read: read, index: index };
            });
            return yield async.map(result, (data) => __awaiter(this, void 0, void 0, function* () {
                if (data.read) {
                    return true;
                }
                const hasUnblockedUnread = yield doesTidHaveUnblockedUnreadPosts(data.tid, {
                    topicTimestamp: topicScores[data.index],
                    userLastReadTimestamp: userScores[data.index],
                    blockedUids: blockedUids,
                });
                if (!hasUnblockedUnread) {
                    data.read = true;
                }
                return data.read;
            }));
        });
    };
    Topics.hasReadTopic = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const hasRead = yield Topics.hasReadTopics([tid], uid);
            return Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false;
        });
    };
    Topics.markUnread = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield Topics.exists(tid);
            if (!exists) {
                throw new Error('[[error:no-topic]]');
            }
            yield db.sortedSetRemove(`uid:${uid}:tids_read`, tid);
            yield db.sortedSetAdd(`uid:${uid}:tids_unread`, Date.now(), tid);
        });
    };
    Topics.filterNewTids = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return [];
            }
            const scores = yield db.sortedSetScores(`uid:${uid}:tids_read`, tids);
            return tids.filter((tid, index) => tid && !scores[index]);
        });
    };
    Topics.filterUnrepliedTids = function (tids) {
        return __awaiter(this, void 0, void 0, function* () {
            const scores = yield db.sortedSetScores('topics:posts', tids);
            return tids.filter((tid, index) => tid && scores[index] !== null && scores[index] <= 1);
        });
    };
}
exports.default = default_1;
;
