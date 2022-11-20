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
const validator = require('validator');
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const search = require('../search');
const categories = require('../categories');
const pagination = require('../pagination');
const privileges = require('../privileges');
const utils = require('../utils');
const helpers = require('./helpers').defualt;
const searchController = {};
searchController.search = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!plugins.hooks.hasListeners('filter:search.query')) {
            return next();
        }
        const page = Math.max(1, parseInt(req.query.page, 10)) || 1;
        const searchOnly = parseInt(req.query.searchOnly, 10) === 1;
        const userPrivileges = yield utils.promiseParallel({
            'search:users': privileges.global.can('search:users', req.uid),
            'search:content': privileges.global.can('search:content', req.uid),
            'search:tags': privileges.global.can('search:tags', req.uid),
        });
        req.query.in = req.query.in || meta_1.default.config.searchDefaultIn || 'titlesposts';
        let allowed = (req.query.in === 'users' && userPrivileges['search:users']) ||
            (req.query.in === 'tags' && userPrivileges['search:tags']) ||
            (req.query.in === 'categories') ||
            (['titles', 'titlesposts', 'posts'].includes(req.query.in) && userPrivileges['search:content']);
        ({ allowed } = yield plugins.hooks.fire('filter:search.isAllowed', {
            uid: req.uid,
            query: req.query,
            allowed,
        }));
        if (!allowed) {
            return helpers.notAllowed(req, res);
        }
        if (req.query.categories && !Array.isArray(req.query.categories)) {
            req.query.categories = [req.query.categories];
        }
        if (req.query.hasTags && !Array.isArray(req.query.hasTags)) {
            req.query.hasTags = [req.query.hasTags];
        }
        const data = {
            query: req.query.term,
            searchIn: req.query.in,
            matchWords: req.query.matchWords || 'all',
            postedBy: req.query.by,
            categories: req.query.categories,
            searchChildren: req.query.searchChildren,
            hasTags: req.query.hasTags,
            replies: req.query.replies,
            repliesFilter: req.query.repliesFilter,
            timeRange: req.query.timeRange,
            timeFilter: req.query.timeFilter,
            sortBy: req.query.sortBy || meta_1.default.config.searchDefaultSortBy || '',
            sortDirection: req.query.sortDirection,
            page: page,
            itemsPerPage: req.query.itemsPerPage,
            uid: req.uid,
            qs: req.query,
        };
        const [searchData, categoriesData] = yield Promise.all([
            search.search(data),
            buildCategories(req.uid, searchOnly),
            recordSearch(data),
        ]);
        searchData.pagination = pagination.create(page, searchData.pageCount, req.query);
        searchData.multiplePages = searchData.pageCount > 1;
        searchData.search_query = validator.escape(String(req.query.term || ''));
        searchData.term = req.query.term;
        if (searchOnly) {
            return res.json(searchData);
        }
        searchData.allCategories = categoriesData;
        searchData.allCategoriesCount = Math.max(10, Math.min(15, categoriesData.length));
        searchData.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[global:search]]' }]);
        searchData.expandSearch = !req.query.term;
        searchData.showAsPosts = !req.query.showAs || req.query.showAs === 'posts';
        searchData.showAsTopics = req.query.showAs === 'topics';
        searchData.title = '[[global:header.search]]';
        searchData.searchDefaultSortBy = meta_1.default.config.searchDefaultSortBy || '';
        searchData.searchDefaultIn = meta_1.default.config.searchDefaultIn || 'titlesposts';
        searchData.privileges = userPrivileges;
        res.render('search', searchData);
    });
};
const searches = {};
function recordSearch(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const { query, searchIn } = data;
        if (query) {
            const cleanedQuery = String(query).trim().toLowerCase().slice(0, 255);
            if (['titles', 'titlesposts', 'posts'].includes(searchIn) && cleanedQuery.length > 2) {
                searches[data.uid] = searches[data.uid] || { timeoutId: 0, queries: [] };
                searches[data.uid].queries.push(cleanedQuery);
                if (searches[data.uid].timeoutId) {
                    clearTimeout(searches[data.uid].timeoutId);
                }
                searches[data.uid].timeoutId = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    if (searches[data.uid] && searches[data.uid].queries) {
                        const copy = searches[data.uid].queries.slice();
                        const filtered = searches[data.uid].queries.filter((q) => !copy.find((query) => query.startsWith(q) && query.length > q.length));
                        delete searches[data.uid];
                        yield Promise.all(filtered.map((query) => database_1.default.sortedSetIncrBy('searches:all', 1, query)));
                    }
                }), 5000);
            }
        }
    });
}
function buildCategories(uid, searchOnly) {
    return __awaiter(this, void 0, void 0, function* () {
        if (searchOnly) {
            return [];
        }
        const cids = yield categories.getCidsByPrivilege('categories:cid', uid, 'read');
        let categoriesData = yield categories.getCategoriesData(cids);
        categoriesData = categoriesData.filter((category) => category && !category.link);
        categoriesData = categories.getTree(categoriesData);
        categoriesData = categories.buildForSelectCategories(categoriesData, ['text', 'value']);
        return [
            { value: 'all', text: '[[unread:all_categories]]' },
            { value: 'watched', text: '[[category:watched-categories]]' },
        ].concat(categoriesData);
    });
}
