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
const nconf_1 = __importDefault(require("nconf"));
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const topics = require('../topics');
const meta_1 = __importDefault(require("../meta"));
const helpers = require('./helpers').defualt;
const pagination = require('../pagination');
const privileges = require('../privileges');
const recentController = {};
const relative_path = nconf_1.default.get('relative_path');
recentController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield recentController.getData(req, 'recent', 'recent');
        if (!data) {
            return next();
        }
        res.render('recent', data);
    });
};
recentController.getData = function (req, url, sort) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        let term = helpers.terms[req.query.term];
        const { cid, tags } = req.query;
        const filter = req.query.filter || '';
        if (!term && req.query.term) {
            return null;
        }
        term = term || 'alltime';
        const [settings, categoryData, rssToken, canPost, isPrivileged] = yield Promise.all([
            user_1.default.getSettings(req.uid),
            helpers.getSelectedCategory(cid),
            user_1.default.auth.getFeedToken(req.uid),
            canPostTopic(req.uid),
            user_1.default.isPrivileged(req.uid),
        ]);
        const start = Math.max(0, (page - 1) * settings.topicsPerPage);
        const stop = start + settings.topicsPerPage - 1;
        const data = yield topics.getSortedTopics({
            cids: cid,
            tags: tags,
            uid: req.uid,
            start: start,
            stop: stop,
            filter: filter,
            term: term,
            sort: sort,
            floatPinned: req.query.pinned,
            query: req.query,
        });
        const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/${url}`) || req.originalUrl.startsWith(`${relative_path}/${url}`));
        const baseUrl = isDisplayedAsHome ? '' : url;
        if (isDisplayedAsHome) {
            data.title = meta_1.default.config.homePageTitle || '[[pages:home]]';
        }
        else {
            data.title = `[[pages:${url}]]`;
            data.breadcrumbs = helpers.buildBreadcrumbs([{ text: `[[${url}:title]]` }]);
        }
        data.canPost = canPost;
        data.showSelect = isPrivileged;
        data.showTopicTools = isPrivileged;
        data.allCategoriesUrl = baseUrl + helpers.buildQueryString(req.query, 'cid', '');
        data.selectedCategory = categoryData.selectedCategory;
        data.selectedCids = categoryData.selectedCids;
        data['feeds:disableRSS'] = meta_1.default.config['feeds:disableRSS'] || 0;
        data.rssFeedUrl = `${relative_path}/${url}.rss`;
        if (req.loggedIn) {
            data.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
        }
        data.filters = helpers.buildFilters(baseUrl, filter, req.query);
        data.selectedFilter = data.filters.find((filter) => filter && filter.selected);
        data.terms = helpers.buildTerms(baseUrl, term, req.query);
        data.selectedTerm = data.terms.find((term) => term && term.selected);
        const pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
        data.pagination = pagination.create(page, pageCount, req.query);
        helpers.addLinkTags({ url: url, res: req.res, tags: data.pagination.rel });
        return data;
    });
};
function canPostTopic(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let cids = yield categories.getAllCidsFromSet('categories:cid');
        cids = yield privileges.categories.filterCids('topics:create', cids, uid);
        return cids.length > 0;
    });
}
require('../promisify').promisify(recentController, ['get']);
