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
const { SitemapStream, streamToPromise } = require('sitemap');
const nconf_1 = __importDefault(require("nconf"));
const db = require('./database');
const categories = require('./categories');
const topics = require('./topics');
const privileges = require('./privileges');
const meta = require('./meta');
const plugins = require('./plugins');
const utils = require('./utils');
const sitemap = {};
sitemap.maps = {
    topics: [],
};
sitemap.render = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const topicsPerPage = meta.config.sitemapTopics;
        const returnData = {
            url: nconf_1.default.get('url'),
            topics: [],
        };
        const [topicCount, categories, pages] = yield Promise.all([
            db.getObjectField('global', 'topicCount'),
            getSitemapCategories(),
            getSitemapPages(),
        ]);
        returnData.categories = categories.length > 0;
        returnData.pages = pages.length > 0;
        const numPages = Math.ceil(Math.max(0, topicCount / topicsPerPage));
        for (let x = 1; x <= numPages; x += 1) {
            returnData.topics.push(x);
        }
        return returnData;
    });
};
function getSitemapPages() {
    return __awaiter(this, void 0, void 0, function* () {
        const urls = [{
                url: '',
                changefreq: 'weekly',
                priority: 0.6,
            }, {
                url: `${nconf_1.default.get('relative_path')}/recent`,
                changefreq: 'daily',
                priority: 0.4,
            }, {
                url: `${nconf_1.default.get('relative_path')}/users`,
                changefreq: 'daily',
                priority: 0.4,
            }, {
                url: `${nconf_1.default.get('relative_path')}/groups`,
                changefreq: 'daily',
                priority: 0.4,
            }];
        const data = yield plugins.hooks.fire('filter:sitemap.getPages', { urls: urls });
        return data.urls;
    });
}
sitemap.getPages = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (sitemap.maps.pages && Date.now() < sitemap.maps.pagesCacheExpireTimestamp) {
            return sitemap.maps.pages;
        }
        const urls = yield getSitemapPages();
        if (!urls.length) {
            sitemap.maps.pages = '';
            sitemap.maps.pagesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
            return sitemap.maps.pages;
        }
        sitemap.maps.pages = yield urlsToSitemap(urls);
        sitemap.maps.pagesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
        return sitemap.maps.pages;
    });
};
function getSitemapCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield categories.getCidsByPrivilege('categories:cid', 0, 'find');
        return yield categories.getCategoriesFields(cids, ['slug']);
    });
}
sitemap.getCategories = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (sitemap.maps.categories && Date.now() < sitemap.maps.categoriesCacheExpireTimestamp) {
            return sitemap.maps.categories;
        }
        const categoryUrls = [];
        const categoriesData = yield getSitemapCategories();
        categoriesData.forEach((category) => {
            if (category) {
                categoryUrls.push({
                    url: `${nconf_1.default.get('relative_path')}/category/${category.slug}`,
                    changefreq: 'weekly',
                    priority: 0.4,
                });
            }
        });
        if (!categoryUrls.length) {
            sitemap.maps.categories = '';
            sitemap.maps.categoriesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
            return sitemap.maps.categories;
        }
        sitemap.maps.categories = yield urlsToSitemap(categoryUrls);
        sitemap.maps.categoriesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
        return sitemap.maps.categories;
    });
};
sitemap.getTopicPage = function (page) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(page, 10) <= 0) {
            return;
        }
        const numTopics = meta.config.sitemapTopics;
        const start = (parseInt(page, 10) - 1) * numTopics;
        const stop = start + numTopics - 1;
        if (sitemap.maps.topics[page - 1] && Date.now() < sitemap.maps.topics[page - 1].cacheExpireTimestamp) {
            return sitemap.maps.topics[page - 1].sm;
        }
        const topicUrls = [];
        let tids = yield db.getSortedSetRange('topics:tid', start, stop);
        tids = yield privileges.topics.filterTids('topics:read', tids, 0);
        const topicData = yield topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime']);
        if (!topicData.length) {
            sitemap.maps.topics[page - 1] = {
                sm: '',
                cacheExpireTimestamp: Date.now() + (1000 * 60 * 60 * 24),
            };
            return sitemap.maps.topics[page - 1].sm;
        }
        topicData.forEach((topic) => {
            if (topic) {
                topicUrls.push({
                    url: `${nconf_1.default.get('relative_path')}/topic/${topic.slug}`,
                    lastmodISO: utils.toISOString(topic.lastposttime),
                    changefreq: 'daily',
                    priority: 0.6,
                });
            }
        });
        sitemap.maps.topics[page - 1] = {
            sm: yield urlsToSitemap(topicUrls),
            cacheExpireTimestamp: Date.now() + (1000 * 60 * 60 * 24),
        };
        return sitemap.maps.topics[page - 1].sm;
    });
};
function urlsToSitemap(urls) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!urls.length) {
            return '';
        }
        const smStream = new SitemapStream({ hostname: nconf_1.default.get('url') });
        urls.forEach(url => smStream.write(url));
        smStream.end();
        return (yield streamToPromise(smStream)).toString();
    });
}
sitemap.clearCache = function () {
    if (sitemap.maps.pages) {
        sitemap.maps.pagesCacheExpireTimestamp = 0;
    }
    if (sitemap.maps.categories) {
        sitemap.maps.categoriesCacheExpireTimestamp = 0;
    }
    sitemap.maps.topics.forEach((topicMap) => {
        topicMap.cacheExpireTimestamp = 0;
    });
};
require('./promisify').promisify(sitemap);
