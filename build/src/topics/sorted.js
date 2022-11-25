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
const privileges = require('../privileges');
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
function default_1(Topics) {
    Topics.getSortedTopics = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                nextStart: 0,
                topicCount: 0,
                topics: [],
            };
            params.term = params.term || 'alltime';
            params.sort = params.sort || 'recent';
            params.query = params.query || {};
            if (params.hasOwnProperty('cids') && params.cids && !Array.isArray(params.cids)) {
                params.cids = [params.cids];
            }
            params.tags = params.tags || [];
            if (params.tags && !Array.isArray(params.tags)) {
                params.tags = [params.tags];
            }
            data.tids = yield getTids(params);
            data.tids = yield sortTids(data.tids, params);
            data.tids = yield filterTids(data.tids.slice(0, meta_1.default.config.recentMaxTopics), params);
            data.topicCount = data.tids.length;
            data.topics = yield getTopics(data.tids, params);
            data.nextStart = params.stop + 1;
            return data;
        });
    };
    function getTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (plugins.hooks.hasListeners('filter:topics.getSortedTids')) {
                const result = yield plugins.hooks.fire('filter:topics.getSortedTids', { params: params, tids: [] });
                return result.tids;
            }
            let tids = [];
            if (params.term !== 'alltime') {
                tids = yield Topics.getLatestTidsFromSet('topics:tid', 0, -1, params.term);
                if (params.filter === 'watched') {
                    tids = yield Topics.filterWatchedTids(tids, params.uid);
                }
            }
            else if (params.filter === 'watched') {
                tids = yield db.getSortedSetRevRange(`uid:${params.uid}:followed_tids`, 0, -1);
            }
            else if (params.cids) {
                tids = yield getCidTids(params);
            }
            else if (params.tags.length) {
                tids = yield getTagTids(params);
            }
            else if (params.sort === 'old') {
                tids = yield db.getSortedSetRange(`topics:recent`, 0, meta_1.default.config.recentMaxTopics - 1);
            }
            else {
                tids = yield db.getSortedSetRevRange(`topics:${params.sort}`, 0, meta_1.default.config.recentMaxTopics - 1);
            }
            return tids;
        });
    }
    function getTagTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const sets = [
                params.sort === 'old' ?
                    'topics:recent' :
                    `topics:${params.sort}`,
                ...params.tags.map((tag) => `tag:${tag}:topics`),
            ];
            const method = params.sort === 'old' ?
                'getSortedSetIntersect' :
                'getSortedSetRevIntersect';
            return yield db[method]({
                sets: sets,
                start: 0,
                stop: meta_1.default.config.recentMaxTopics - 1,
                weights: sets.map((s, index) => (index ? 0 : 1)),
            });
        });
    }
    function getCidTids(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (params.tags.length) {
                return _.intersection(...yield Promise.all(params.tags.map((tag) => __awaiter(this, void 0, void 0, function* () {
                    const sets = params.cids.map((cid) => `cid:${cid}:tag:${tag}:topics`);
                    return yield db.getSortedSetRevRange(sets, 0, -1);
                }))));
            }
            const sets = [];
            const pinnedSets = [];
            params.cids.forEach((cid) => {
                if (params.sort === 'recent' || params.sort === 'old') {
                    sets.push(`cid:${cid}:tids`);
                }
                else {
                    sets.push(`cid:${cid}:tids${params.sort ? `:${params.sort}` : ''}`);
                }
                pinnedSets.push(`cid:${cid}:tids:pinned`);
            });
            let pinnedTids = yield db.getSortedSetRevRange(pinnedSets, 0, -1);
            pinnedTids = yield Topics.tools.checkPinExpiry(pinnedTids);
            const method = params.sort === 'old' ?
                'getSortedSetRange' :
                'getSortedSetRevRange';
            const tids = yield db[method](sets, 0, meta_1.default.config.recentMaxTopics - 1);
            return pinnedTids.concat(tids);
        });
    }
    function sortTids(tids, params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (params.term === 'alltime' && !params.cids && !params.tags.length && params.filter !== 'watched' && !params.floatPinned) {
                return tids;
            }
            const topicData = yield Topics.getTopicsFields(tids, ['tid', 'lastposttime', 'upvotes', 'downvotes', 'postcount', 'pinned']);
            const sortMap = {
                recent: sortRecent,
                old: sortOld,
                posts: sortPopular,
                votes: sortVotes,
                views: sortViews,
            };
            const sortFn = sortMap[params.sort] || sortRecent;
            if (params.floatPinned) {
                floatPinned(topicData, sortFn);
            }
            else {
                topicData.sort(sortFn);
            }
            return topicData.map((topic) => topic && topic.tid);
        });
    }
    function floatPinned(topicData, sortFn) {
        topicData.sort((a, b) => (a.pinned !== b.pinned ? b.pinned - a.pinned : sortFn(a, b)));
    }
    function sortRecent(a, b) {
        return b.lastposttime - a.lastposttime;
    }
    function sortOld(a, b) {
        return a.lastposttime - b.lastposttime;
    }
    function sortVotes(a, b) {
        if (a.votes !== b.votes) {
            return b.votes - a.votes;
        }
        return b.postcount - a.postcount;
    }
    function sortPopular(a, b) {
        if (a.postcount !== b.postcount) {
            return b.postcount - a.postcount;
        }
        return b.viewcount - a.viewcount;
    }
    function sortViews(a, b) {
        return b.viewcount - a.viewcount;
    }
    function filterTids(tids, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { filter } = params;
            const { uid } = params;
            if (filter === 'new') {
                tids = yield Topics.filterNewTids(tids, uid);
            }
            else if (filter === 'unreplied') {
                tids = yield Topics.filterUnrepliedTids(tids);
            }
            else {
                tids = yield Topics.filterNotIgnoredTids(tids, uid);
            }
            tids = yield privileges.topics.filterTids('topics:read', tids, uid);
            let topicData = yield Topics.getTopicsFields(tids, ['uid', 'tid', 'cid']);
            const topicCids = _.uniq(topicData.map((topic) => topic.cid)).filter(Boolean);
            function getIgnoredCids() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (params.cids || filter === 'watched' || meta_1.default.config.disableRecentCategoryFilter) {
                        return [];
                    }
                    return yield categories.isIgnored(topicCids, uid);
                });
            }
            const [ignoredCids, filtered] = yield Promise.all([
                getIgnoredCids(),
                user_1.default.blocks.filter(uid, topicData),
            ]);
            const isCidIgnored = _.zipObject(topicCids, ignoredCids);
            topicData = filtered;
            const cids = params.cids && params.cids.map(String);
            tids = topicData.filter((t) => (t &&
                t.cid &&
                !isCidIgnored[t.cid] &&
                (!cids || cids.includes(String(t.cid))))).map((t) => t.tid);
            const result = yield plugins.hooks.fire('filter:topics.filterSortedTids', { tids: tids, params: params });
            return result.tids;
        });
    }
    function getTopics(tids, params) {
        return __awaiter(this, void 0, void 0, function* () {
            tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);
            const topicData = yield Topics.getTopicsByTids(tids, params);
            Topics.calculateTopicIndices(topicData, params.start);
            return topicData;
        });
    }
    Topics.calculateTopicIndices = function (topicData, start) {
        topicData.forEach((topic, index) => {
            if (topic) {
                topic.index = start + index;
            }
        });
    };
}
exports.default = default_1;
;
