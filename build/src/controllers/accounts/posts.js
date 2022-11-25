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
const database = __importStar(require("../../database"));
const db = database;
const user_1 = __importDefault(require("../../user"));
const posts = require('../../posts');
const topics = require('../../topics');
const categories_1 = __importDefault(require("../../categories"));
const privileges = require('../../privileges');
const pagination = require('../../pagination');
const helpers_1 = __importDefault(require("../helpers"));
const accountHelpers = require('./helpers').defualt;
const plugins = require('../../plugins');
const utils = require('../../utils');
const postsController = {};
const templateToData = {
    'account/bookmarks': {
        type: 'posts',
        noItemsFoundKey: '[[topic:bookmarks.has_no_bookmarks]]',
        crumb: '[[user:bookmarks]]',
        getSets: function (callerUid, userData) {
            return `uid:${userData.uid}:bookmarks`;
        },
    },
    'account/posts': {
        type: 'posts',
        noItemsFoundKey: '[[user:has_no_posts]]',
        crumb: '[[global:posts]]',
        getSets: function (callerUid, userData) {
            return __awaiter(this, void 0, void 0, function* () {
                // @ts-ignore
                const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
                return cids.map((c) => `cid:${c}:uid:${userData.uid}:pids`);
            });
        },
    },
    'account/upvoted': {
        type: 'posts',
        noItemsFoundKey: '[[user:has_no_upvoted_posts]]',
        crumb: '[[global:upvoted]]',
        getSets: function (callerUid, userData) {
            return `uid:${userData.uid}:upvote`;
        },
    },
    'account/downvoted': {
        type: 'posts',
        noItemsFoundKey: '[[user:has_no_downvoted_posts]]',
        crumb: '[[global:downvoted]]',
        getSets: function (callerUid, userData) {
            return `uid:${userData.uid}:downvote`;
        },
    },
    'account/best': {
        type: 'posts',
        noItemsFoundKey: '[[user:has_no_best_posts]]',
        crumb: '[[global:best]]',
        getSets: function (callerUid, userData) {
            return __awaiter(this, void 0, void 0, function* () {
                // @ts-ignore
                const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
                return cids.map((c) => `cid:${c}:uid:${userData.uid}:pids:votes`);
            });
        },
        getTopics: (sets, req, start, stop) => __awaiter(void 0, void 0, void 0, function* () {
            let pids = yield db.getSortedSetRevRangeByScore(sets, start, stop - start + 1, '+inf', 1);
            pids = yield privileges.posts.filter('topics:read', pids, req.uid);
            const postObjs = yield posts.getPostSummaryByPids(pids, req.uid, { stripTags: false });
            return { posts: postObjs, nextStart: stop + 1 };
        }),
        getItemCount: (sets) => __awaiter(void 0, void 0, void 0, function* () {
            const counts = yield Promise.all(sets.map(set => db.sortedSetCount(set, 1, '+inf')));
            return counts.reduce((acc, val) => acc + val, 0);
        }),
    },
    'account/controversial': {
        type: 'posts',
        noItemsFoundKey: '[[user:has_no_controversial_posts]]',
        crumb: '[[global:controversial]]',
        getSets: function (callerUid, userData) {
            return __awaiter(this, void 0, void 0, function* () {
                // @ts-ignore
                const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
                return cids.map((c) => `cid:${c}:uid:${userData.uid}:pids:votes`);
            });
        },
        getTopics: (sets, req, start, stop) => __awaiter(void 0, void 0, void 0, function* () {
            let pids = yield db.getSortedSetRangeByScore(sets, start, stop - start + 1, '-inf', -1);
            pids = yield privileges.posts.filter('topics:read', pids, req.uid);
            const postObjs = yield posts.getPostSummaryByPids(pids, req.uid, { stripTags: false });
            return { posts: postObjs, nextStart: stop + 1 };
        }),
        getItemCount: (sets) => __awaiter(void 0, void 0, void 0, function* () {
            const counts = yield Promise.all(sets.map(set => db.sortedSetCount(set, '-inf', -1)));
            return counts.reduce((acc, val) => acc + val, 0);
        }),
    },
    'account/watched': {
        type: 'topics',
        noItemsFoundKey: '[[user:has_no_watched_topics]]',
        crumb: '[[user:watched]]',
        getSets: function (callerUid, userData) {
            return `uid:${userData.uid}:followed_tids`;
        },
        getTopics: function (set, req, start, stop) {
            return __awaiter(this, void 0, void 0, function* () {
                const { sort } = req.query;
                const map = {
                    votes: 'topics:votes',
                    posts: 'topics:posts',
                    views: 'topics:views',
                    lastpost: 'topics:recent',
                    firstpost: 'topics:tid',
                };
                if (!sort || !map[sort]) {
                    return yield topics.getTopicsFromSet(set, req.uid, start, stop);
                }
                const sortSet = map[sort];
                let tids = yield db.getSortedSetRevRange(set, 0, -1);
                const scores = yield db.sortedSetScores(sortSet, tids);
                tids = tids.map((tid, i) => ({ tid: tid, score: scores[i] }))
                    .sort((a, b) => b.score - a.score)
                    .slice(start, stop + 1)
                    .map((t) => t.tid);
                const topicsData = yield topics.getTopics(tids, req.uid);
                topics.calculateTopicIndices(topicsData, start);
                return { topics: topicsData, nextStart: stop + 1 };
            });
        },
    },
    'account/ignored': {
        type: 'topics',
        noItemsFoundKey: '[[user:has_no_ignored_topics]]',
        crumb: '[[user:ignored]]',
        getSets: function (callerUid, userData) {
            return `uid:${userData.uid}:ignored_tids`;
        },
    },
    'account/topics': {
        type: 'topics',
        noItemsFoundKey: '[[user:has_no_topics]]',
        crumb: '[[global:topics]]',
        getSets: function (callerUid, userData) {
            return __awaiter(this, void 0, void 0, function* () {
                // @ts-ignore
                const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
                return cids.map((c) => `cid:${c}:uid:${userData.uid}:tids`);
            });
        },
    },
};
postsController.getBookmarks = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/bookmarks', req, res, next);
    });
};
postsController.getPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/posts', req, res, next);
    });
};
postsController.getUpVotedPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/upvoted', req, res, next);
    });
};
postsController.getDownVotedPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/downvoted', req, res, next);
    });
};
postsController.getBestPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/best', req, res, next);
    });
};
postsController.getControversialPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/controversial', req, res, next);
    });
};
postsController.getWatchedTopics = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/watched', req, res, next);
    });
};
postsController.getIgnoredTopics = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/ignored', req, res, next);
    });
};
postsController.getTopics = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getPostsFromUserSet('account/topics', req, res, next);
    });
};
function getPostsFromUserSet(template, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = templateToData[template];
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const [userData, settings] = yield Promise.all([
            accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query),
            user_1.default.getSettings(req.uid),
        ]);
        if (!userData) {
            return next();
        }
        const itemsPerPage = data.type === 'topics' ? settings.topicsPerPage : settings.postsPerPage;
        const start = (page - 1) * itemsPerPage;
        const stop = start + itemsPerPage - 1;
        const sets = yield data.getSets(req.uid, userData);
        let result;
        if (plugins.hooks.hasListeners('filter:account.getPostsFromUserSet')) {
            result = yield plugins.hooks.fire('filter:account.getPostsFromUserSet', {
                req: req,
                template: template,
                userData: userData,
                settings: settings,
                data: data,
                start: start,
                stop: stop,
                itemCount: 0,
                itemData: [],
            });
        }
        else {
            result = yield utils.promiseParallel({
                itemCount: getItemCount(sets, data, settings),
                itemData: getItemData(sets, data, req, start, stop),
            });
        }
        const { itemCount, itemData } = result;
        userData[data.type] = itemData[data.type];
        userData.nextStart = itemData.nextStart;
        const pageCount = Math.ceil(itemCount / itemsPerPage);
        userData.pagination = pagination.create(page, pageCount, req.query);
        userData.noItemsFoundKey = data.noItemsFoundKey;
        userData.title = `[[pages:${template}, ${userData.username}]]`;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: data.crumb }]);
        userData.showSort = template === 'account/watched';
        const baseUrl = (req.baseUrl + req.path.replace(/^\/api/, ''));
        userData.sortOptions = [
            { url: `${baseUrl}?sort=votes`, name: '[[global:votes]]' },
            { url: `${baseUrl}?sort=posts`, name: '[[global:posts]]' },
            { url: `${baseUrl}?sort=views`, name: '[[global:views]]' },
            { url: `${baseUrl}?sort=lastpost`, name: '[[global:lastpost]]' },
            { url: `${baseUrl}?sort=firstpost`, name: '[[global:firstpost]]' },
        ];
        userData.sortOptions.forEach((option) => {
            option.selected = option.url.includes(`sort=${req.query.sort}`);
        });
        res.render(template, userData);
    });
}
function getItemData(sets, data, req, start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data.getTopics) {
            return yield data.getTopics(sets, req, start, stop);
        }
        const method = data.type === 'topics' ? topics.getTopicsFromSet : posts.getPostSummariesFromSet;
        return yield method(sets, req.uid, start, stop);
    });
}
function getItemCount(sets, data, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!settings.usePagination) {
            return 0;
        }
        if (data.getItemCount) {
            return yield data.getItemCount(sets);
        }
        return yield db.sortedSetsCardSum(sets);
    });
}
