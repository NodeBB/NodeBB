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
const posts = require('../posts');
const flags = require('../flags');
const analytics = require('../analytics');
const plugins = require('../plugins');
const pagination = require('../pagination');
const privileges = require('../privileges');
const utils = require('../utils');
const helpers = require('./helpers').defualt;
const modsController = {};
modsController.flags = {};
modsController.flags.list = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const validFilters = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'cid', 'quick', 'page', 'perPage'];
        const validSorts = ['newest', 'oldest', 'reports', 'upvotes', 'downvotes', 'replies'];
        const results = yield Promise.all([
            user_1.default.isAdminOrGlobalMod(req.uid),
            user_1.default.getModeratedCids(req.uid),
            plugins.hooks.fire('filter:flags.validateFilters', { filters: validFilters }),
            plugins.hooks.fire('filter:flags.validateSort', { sorts: validSorts }),
        ]);
        const [isAdminOrGlobalMod, moderatedCids, , { sorts }] = results;
        let [, , { filters }] = results;
        if (!(isAdminOrGlobalMod || !!moderatedCids.length)) {
            return helpers.notAllowed(req, res);
        }
        if (!isAdminOrGlobalMod && moderatedCids.length) {
            res.locals.cids = moderatedCids.map((cid) => String(cid));
        }
        // Parse query string params for filters, eliminate non-valid filters
        filters = filters.reduce((memo, cur) => {
            if (req.query.hasOwnProperty(cur)) {
                if (typeof req.query[cur] === 'string' && req.query[cur].trim() !== '') {
                    memo[cur] = req.query[cur].trim();
                }
                else if (Array.isArray(req.query[cur]) && req.query[cur].length) {
                    memo[cur] = req.query[cur];
                }
            }
            return memo;
        }, {});
        let hasFilter = !!Object.keys(filters).length;
        if (res.locals.cids) {
            if (!filters.cid) {
                // If mod and no cid filter, add filter for their modded categories
                filters.cid = res.locals.cids;
            }
            else if (Array.isArray(filters.cid)) {
                // Remove cids they do not moderate
                filters.cid = filters.cid.filter((cid) => res.locals.cids.includes(String(cid)));
            }
            else if (!res.locals.cids.includes(String(filters.cid))) {
                filters.cid = res.locals.cids;
                hasFilter = false;
            }
        }
        // Pagination doesn't count as a filter
        if ((Object.keys(filters).length === 1 && filters.hasOwnProperty('page')) ||
            (Object.keys(filters).length === 2 && filters.hasOwnProperty('page') && filters.hasOwnProperty('perPage'))) {
            hasFilter = false;
        }
        // Parse sort from query string
        let sort;
        if (req.query.sort) {
            sort = sorts.includes(req.query.sort) ? req.query.sort : null;
        }
        if (sort === 'newest') {
            sort = undefined;
        }
        hasFilter = hasFilter || !!sort;
        const [flagsData, analyticsData, selectData] = yield Promise.all([
            flags.list({
                filters: filters,
                sort: sort,
                uid: req.uid,
                query: req.query,
            }),
            analytics.getDailyStatsForSet('analytics:flags', Date.now(), 30),
            helpers.getSelectedCategory(filters.cid),
        ]);
        res.render('flags/list', {
            flags: flagsData.flags,
            analytics: analyticsData,
            selectedCategory: selectData.selectedCategory,
            hasFilter: hasFilter,
            filters: filters,
            expanded: !!(filters.assignee || filters.reporterId || filters.targetUid),
            sort: sort || 'newest',
            title: '[[pages:flags]]',
            pagination: pagination.create(flagsData.page, flagsData.pageCount, req.query),
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:flags]]' }]),
        });
    });
};
modsController.flags.detail = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield utils.promiseParallel({
            isAdminOrGlobalMod: user_1.default.isAdminOrGlobalMod(req.uid),
            moderatedCids: user_1.default.getModeratedCids(req.uid),
            flagData: flags.get(req.params.flagId),
            assignees: user_1.default.getAdminsandGlobalModsandModerators(),
            privileges: Promise.all(['global', 'admin'].map((type) => __awaiter(this, void 0, void 0, function* () { return privileges[type].get(req.uid); }))),
        });
        results.privileges = Object.assign(Object.assign({}, results.privileges[0]), results.privileges[1]);
        if (!results.flagData || (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length))) {
            return next(); // 404
        }
        results.flagData.history = results.isAdminOrGlobalMod ? (yield flags.getHistory(req.params.flagId)) : null;
        if (results.flagData.type === 'user') {
            results.flagData.type_path = 'uid';
        }
        else if (results.flagData.type === 'post') {
            results.flagData.type_path = 'post';
        }
        res.render('flags/detail', Object.assign(results.flagData, {
            assignees: results.assignees,
            type_bool: ['post', 'user', 'empty'].reduce((memo, cur) => {
                if (cur !== 'empty') {
                    memo[cur] = results.flagData.type === cur && (!results.flagData.target ||
                        !!Object.keys(results.flagData.target).length);
                }
                else {
                    memo[cur] = !Object.keys(results.flagData.target).length;
                }
                return memo;
            }, {}),
            title: `[[pages:flag-details, ${req.params.flagId}]]`,
            privileges: results.privileges,
            breadcrumbs: helpers.buildBreadcrumbs([
                { text: '[[pages:flags]]', url: '/flags' },
                { text: `[[pages:flag-details, ${req.params.flagId}]]` },
            ]),
        }));
    });
};
modsController.postQueue = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.loggedIn) {
            return next();
        }
        const { id } = req.params;
        const { cid } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const postsPerPage = 20;
        let postData = yield posts.getQueuedPosts({ id: id });
        const [isAdmin, isGlobalMod, moderatedCids, categoriesData] = yield Promise.all([
            user_1.default.isAdministrator(req.uid),
            user_1.default.isGlobalModerator(req.uid),
            user_1.default.getModeratedCids(req.uid),
            helpers.getSelectedCategory(cid),
        ]);
        postData = postData.filter((p) => p &&
            (!categoriesData.selectedCids.length || categoriesData.selectedCids.includes(p.category.cid)) &&
            (isAdmin || isGlobalMod || moderatedCids.includes(Number(p.category.cid)) || req.uid === p.user.uid));
        ({ posts: postData } = yield plugins.hooks.fire('filter:post-queue.get', {
            posts: postData,
            req: req,
        }));
        const pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
        const start = (page - 1) * postsPerPage;
        const stop = start + postsPerPage - 1;
        postData = postData.slice(start, stop + 1);
        const crumbs = [{ text: '[[pages:post-queue]]', url: id ? '/post-queue' : undefined }];
        if (id && postData.length) {
            const text = postData[0].data.tid ? '[[post-queue:reply]]' : '[[post-queue:topic]]';
            crumbs.push({ text: text });
        }
        res.render('post-queue', Object.assign(Object.assign({ title: '[[pages:post-queue]]', posts: postData, isAdmin: isAdmin, canAccept: isAdmin || isGlobalMod || !!moderatedCids.length }, categoriesData), { allCategoriesUrl: `post-queue${helpers.buildQueryString(req.query, 'cid', '')}`, pagination: pagination.create(page, pageCount), breadcrumbs: helpers.buildBreadcrumbs(crumbs), singlePost: !!id }));
    });
};
