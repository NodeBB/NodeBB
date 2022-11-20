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
const validator = require('validator');
const qs = require('querystring');
const database_1 = __importDefault(require("../database"));
const privileges = require('../privileges');
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const meta_1 = __importDefault(require("../meta"));
const pagination = require('../pagination');
const helpers = require('./helpers').defualt;
const utils = require('../utils');
const translator = require('../translator');
const analytics = require('../analytics');
const categoryController = {};
const url = nconf_1.default.get('url');
const relative_path = nconf_1.default.get('relative_path');
categoryController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const cid = req.params.category_id;
        let currentPage = parseInt(req.query.page, 10) || 1;
        let topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) - 1 : 0;
        if ((req.params.topic_index && !utils.isNumber(req.params.topic_index)) || !utils.isNumber(cid)) {
            return next();
        }
        const [categoryFields, userPrivileges, userSettings, rssToken] = yield Promise.all([
            categories.getCategoryFields(cid, ['slug', 'disabled', 'link']),
            privileges.categories.get(cid, req.uid),
            user_1.default.getSettings(req.uid),
            user_1.default.auth.getFeedToken(req.uid),
        ]);
        if (!categoryFields.slug ||
            (categoryFields && categoryFields.disabled) ||
            (userSettings.usePagination && currentPage < 1)) {
            return next();
        }
        if (topicIndex < 0) {
            return helpers.redirect(res, `/category/${categoryFields.slug}?${qs.stringify(req.query)}`);
        }
        if (!userPrivileges.read) {
            return helpers.notAllowed(req, res);
        }
        if (!res.locals.isAPI && !req.params.slug && (categoryFields.slug && categoryFields.slug !== `${cid}/`)) {
            return helpers.redirect(res, `/category/${categoryFields.slug}?${qs.stringify(req.query)}`, true);
        }
        if (categoryFields.link) {
            yield database_1.default.incrObjectField(`category:${cid}`, 'timesClicked');
            return helpers.redirect(res, validator.unescape(categoryFields.link));
        }
        if (!userSettings.usePagination) {
            topicIndex = Math.max(0, topicIndex - (Math.ceil(userSettings.topicsPerPage / 2) - 1));
        }
        else if (!req.query.page) {
            const index = Math.max(parseInt((topicIndex || 0), 10), 0);
            currentPage = Math.ceil((index + 1) / userSettings.topicsPerPage);
            topicIndex = 0;
        }
        const targetUid = yield user_1.default.getUidByUserslug(req.query.author);
        const start = ((currentPage - 1) * userSettings.topicsPerPage) + topicIndex;
        const stop = start + userSettings.topicsPerPage - 1;
        const categoryData = yield categories.getCategoryById({
            uid: req.uid,
            cid: cid,
            start: start,
            stop: stop,
            sort: req.query.sort || userSettings.categoryTopicSort,
            settings: userSettings,
            query: req.query,
            tag: req.query.tag,
            targetUid: targetUid,
        });
        if (!categoryData) {
            return next();
        }
        if (topicIndex > Math.max(categoryData.topic_count - 1, 0)) {
            return helpers.redirect(res, `/category/${categoryData.slug}/${categoryData.topic_count}?${qs.stringify(req.query)}`);
        }
        const pageCount = Math.max(1, Math.ceil(categoryData.topic_count / userSettings.topicsPerPage));
        if (userSettings.usePagination && currentPage > pageCount) {
            return next();
        }
        categories.modifyTopicsByPrivilege(categoryData.topics, userPrivileges);
        categoryData.tagWhitelist = categories.filterTagWhitelist(categoryData.tagWhitelist, userPrivileges.isAdminOrMod);
        yield buildBreadcrumbs(req, categoryData);
        if (categoryData.children.length) {
            const allCategories = [];
            categories.flattenCategories(allCategories, categoryData.children);
            yield categories.getRecentTopicReplies(allCategories, req.uid, req.query);
            categoryData.subCategoriesLeft = Math.max(0, categoryData.children.length - categoryData.subCategoriesPerPage);
            categoryData.hasMoreSubCategories = categoryData.children.length > categoryData.subCategoriesPerPage;
            categoryData.nextSubCategoryStart = categoryData.subCategoriesPerPage;
            categoryData.children = categoryData.children.slice(0, categoryData.subCategoriesPerPage);
            categoryData.children.forEach((child) => {
                if (child) {
                    helpers.trimChildren(child);
                    helpers.setCategoryTeaser(child);
                }
            });
        }
        categoryData.title = translator.escape(categoryData.name);
        categoryData.selectCategoryLabel = '[[category:subcategories]]';
        categoryData.description = translator.escape(categoryData.description);
        categoryData.privileges = userPrivileges;
        categoryData.showSelect = userPrivileges.editable;
        categoryData.showTopicTools = userPrivileges.editable;
        categoryData.topicIndex = topicIndex;
        categoryData.rssFeedUrl = `${url}/category/${categoryData.cid}.rss`;
        if (parseInt(req.uid, 10)) {
            categories.markAsRead([cid], req.uid);
            categoryData.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
        }
        addTags(categoryData, res);
        categoryData['feeds:disableRSS'] = meta_1.default.config['feeds:disableRSS'] || 0;
        categoryData['reputation:disabled'] = meta_1.default.config['reputation:disabled'];
        categoryData.pagination = pagination.create(currentPage, pageCount, req.query);
        categoryData.pagination.rel.forEach((rel) => {
            rel.href = `${url}/category/${categoryData.slug}${rel.href}`;
            res.locals.linkTags.push(rel);
        });
        analytics.increment([`pageviews:byCid:${categoryData.cid}`]);
        res.render('category', categoryData);
    });
};
function buildBreadcrumbs(req, categoryData) {
    return __awaiter(this, void 0, void 0, function* () {
        const breadcrumbs = [
            {
                text: categoryData.name,
                url: `${relative_path}/category/${categoryData.slug}`,
                cid: categoryData.cid,
            },
        ];
        const crumbs = yield helpers.buildCategoryBreadcrumbs(categoryData.parentCid);
        if (req.originalUrl.startsWith(`${relative_path}/api/category`) || req.originalUrl.startsWith(`${relative_path}/category`)) {
            categoryData.breadcrumbs = crumbs.concat(breadcrumbs);
        }
    });
}
function addTags(categoryData, res) {
    res.locals.metaTags = [
        {
            name: 'title',
            content: categoryData.name,
            noEscape: true,
        },
        {
            property: 'og:title',
            content: categoryData.name,
            noEscape: true,
        },
        {
            name: 'description',
            content: categoryData.description,
            noEscape: true,
        },
        {
            property: 'og:type',
            content: 'website',
        },
    ];
    if (categoryData.backgroundImage) {
        if (!categoryData.backgroundImage.startsWith('http')) {
            categoryData.backgroundImage = url + categoryData.backgroundImage;
        }
        res.locals.metaTags.push({
            property: 'og:image',
            content: categoryData.backgroundImage,
        });
    }
    res.locals.linkTags = [
        {
            rel: 'up',
            href: url,
        },
    ];
    if (!categoryData['feeds:disableRSS']) {
        res.locals.linkTags.push({
            rel: 'alternate',
            type: 'application/rss+xml',
            href: categoryData.rssFeedUrl,
        });
    }
}
