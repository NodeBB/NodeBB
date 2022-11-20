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
const querystring = require('querystring');
const _ = require('lodash');
const chalk = require('chalk');
const translator = require('../translator');
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const categories = require('../categories');
const plugins = require('../plugins');
const meta_1 = __importDefault(require("../meta"));
const middlewareHelpers = require('../middleware/helpers');
const utils = require('../utils');
const helpers = {};
const relative_path = nconf_1.default.get('relative_path');
const url = nconf_1.default.get('url');
helpers.noScriptErrors = function (req, res, error, httpStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.body.noscript !== 'true') {
            if (typeof error === 'string') {
                return res.status(httpStatus).send(error);
            }
            return res.status(httpStatus).json(error);
        }
        const middleware = require('../middleware');
        const httpStatusString = httpStatus.toString();
        yield middleware.buildHeaderAsync(req, res);
        res.status(httpStatus).render(httpStatusString, {
            path: req.path,
            loggedIn: req.loggedIn,
            error: error,
            returnLink: true,
            title: `[[global:${httpStatusString}.title]]`,
        });
    });
};
helpers.terms = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
};
helpers.buildQueryString = function (query, key, value) {
    const queryObj = Object.assign({}, query);
    if (value) {
        queryObj[key] = value;
    }
    else {
        delete queryObj[key];
    }
    delete queryObj._;
    return Object.keys(queryObj).length ? `?${querystring.stringify(queryObj)}` : '';
};
helpers.addLinkTags = function (params) {
    params.res.locals.linkTags = params.res.locals.linkTags || [];
    params.res.locals.linkTags.push({
        rel: 'canonical',
        href: `${url}/${params.url}`,
    });
    params.tags.forEach((rel) => {
        rel.href = `${url}/${params.url}${rel.href}`;
        params.res.locals.linkTags.push(rel);
    });
};
helpers.buildFilters = function (url, filter, query) {
    return [{
            name: '[[unread:all-topics]]',
            url: url + helpers.buildQueryString(query, 'filter', ''),
            selected: filter === '',
            filter: '',
            icon: 'fa-book',
        }, {
            name: '[[unread:new-topics]]',
            url: url + helpers.buildQueryString(query, 'filter', 'new'),
            selected: filter === 'new',
            filter: 'new',
            icon: 'fa-clock-o',
        }, {
            name: '[[unread:watched-topics]]',
            url: url + helpers.buildQueryString(query, 'filter', 'watched'),
            selected: filter === 'watched',
            filter: 'watched',
            icon: 'fa-bell-o',
        }, {
            name: '[[unread:unreplied-topics]]',
            url: url + helpers.buildQueryString(query, 'filter', 'unreplied'),
            selected: filter === 'unreplied',
            filter: 'unreplied',
            icon: 'fa-reply',
        }];
};
helpers.buildTerms = function (url, term, query) {
    return [{
            name: '[[recent:alltime]]',
            url: url + helpers.buildQueryString(query, 'term', ''),
            selected: term === 'alltime',
            term: 'alltime',
        }, {
            name: '[[recent:day]]',
            url: url + helpers.buildQueryString(query, 'term', 'daily'),
            selected: term === 'day',
            term: 'day',
        }, {
            name: '[[recent:week]]',
            url: url + helpers.buildQueryString(query, 'term', 'weekly'),
            selected: term === 'week',
            term: 'week',
        }, {
            name: '[[recent:month]]',
            url: url + helpers.buildQueryString(query, 'term', 'monthly'),
            selected: term === 'month',
            term: 'month',
        }];
};
helpers.notAllowed = function (req, res, error) {
    return __awaiter(this, void 0, void 0, function* () {
        ({ error } = yield plugins.hooks.fire('filter:helpers.notAllowed', { req, res, error }));
        yield plugins.hooks.fire('response:helpers.notAllowed', { req, res, error });
        if (res.headersSent) {
            return;
        }
        if (req.loggedIn || req.uid === -1) {
            if (res.locals.isAPI) {
                if (req.originalUrl.startsWith(`${relative_path}/api/v3`)) {
                    helpers.formatApiResponse(403, res, error);
                }
                else {
                    res.status(403).json({
                        path: req.path.replace(/^\/api/, ''),
                        loggedIn: req.loggedIn,
                        error: error,
                        title: '[[global:403.title]]',
                        bodyClass: middlewareHelpers.buildBodyClass(req, res),
                    });
                }
            }
            else {
                const middleware = require('../middleware');
                yield middleware.buildHeaderAsync(req, res);
                res.status(403).render('403', {
                    path: req.path,
                    loggedIn: req.loggedIn,
                    error,
                    title: '[[global:403.title]]',
                });
            }
        }
        else if (res.locals.isAPI) {
            req.session.returnTo = req.url.replace(/^\/api/, '');
            helpers.formatApiResponse(401, res, error);
        }
        else {
            req.session.returnTo = req.url;
            res.redirect(`${relative_path}/login${req.path.startsWith('/admin') ? '?local=1' : ''}`);
        }
    });
};
helpers.redirect = function (res, url, permanent) {
    // this is used by sso plugins to redirect to the auth route
    // { external: '/auth/sso' } or { external: 'https://domain/auth/sso' }
    if (url.hasOwnProperty('external')) {
        const redirectUrl = encodeURI(prependRelativePath(url.external));
        if (res.locals.isAPI) {
            res.set('X-Redirect', redirectUrl).status(200).json({ external: redirectUrl });
        }
        else {
            res.redirect(permanent ? 308 : 307, redirectUrl);
        }
        return;
    }
    if (res.locals.isAPI) {
        url = encodeURI(url);
        res.set('X-Redirect', url).status(200).json(url);
    }
    else {
        res.redirect(permanent ? 308 : 307, encodeURI(prependRelativePath(url)));
    }
};
function prependRelativePath(url) {
    return url.startsWith('http://') || url.startsWith('https://') ?
        url : relative_path + url;
}
helpers.buildCategoryBreadcrumbs = function (cid) {
    return __awaiter(this, void 0, void 0, function* () {
        const breadcrumbs = [];
        while (parseInt(cid, 10)) {
            /* eslint-disable no-await-in-loop */
            const data = yield categories.getCategoryFields(cid, ['name', 'slug', 'parentCid', 'disabled', 'isSection']);
            if (!data.disabled && !data.isSection) {
                breadcrumbs.unshift({
                    text: String(data.name),
                    url: `${relative_path}/category/${data.slug}`,
                    cid: cid,
                });
            }
            cid = data.parentCid;
        }
        if (meta_1.default.config.homePageRoute && meta_1.default.config.homePageRoute !== 'categories') {
            breadcrumbs.unshift({
                text: '[[global:header.categories]]',
                url: `${relative_path}/categories`,
            });
        }
        breadcrumbs.unshift({
            text: '[[global:home]]',
            url: `${relative_path}/`,
        });
        return breadcrumbs;
    });
};
helpers.buildBreadcrumbs = function (crumbs) {
    const breadcrumbs = [
        {
            text: '[[global:home]]',
            url: `${relative_path}/`,
        },
    ];
    crumbs.forEach((crumb) => {
        if (crumb) {
            if (crumb.url) {
                crumb.url = `${utils.isRelativeUrl(crumb.url) ? relative_path : ''}${crumb.url}`;
            }
            breadcrumbs.push(crumb);
        }
    });
    return breadcrumbs;
};
helpers.buildTitle = function (pageTitle) {
    const titleLayout = meta_1.default.config.titleLayout || '{pageTitle} | {browserTitle}';
    const browserTitle = validator.escape(String(meta_1.default.config.browserTitle || meta_1.default.config.title || 'NodeBB'));
    pageTitle = pageTitle || '';
    const title = titleLayout.replace('{pageTitle}', () => pageTitle).replace('{browserTitle}', () => browserTitle);
    return title;
};
helpers.getCategories = function (set, uid, privilege, selectedCid) {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield categories.getCidsByPrivilege(set, uid, privilege);
        return yield getCategoryData(cids, uid, selectedCid, Object.values(categories.watchStates), privilege);
    });
};
helpers.getCategoriesByStates = function (uid, selectedCid, states, privilege = 'topics:read') {
    return __awaiter(this, void 0, void 0, function* () {
        const cids = yield categories.getAllCidsFromSet('categories:cid');
        return yield getCategoryData(cids, uid, selectedCid, states, privilege);
    });
};
function getCategoryData(cids, uid, selectedCid, states, privilege) {
    return __awaiter(this, void 0, void 0, function* () {
        const [visibleCategories, selectData] = yield Promise.all([
            helpers.getVisibleCategories({
                cids, uid, states, privilege, showLinks: false,
            }),
            helpers.getSelectedCategory(selectedCid),
        ]);
        const categoriesData = categories.buildForSelectCategories(visibleCategories, ['disabledClass']);
        categoriesData.forEach((category) => {
            category.selected = selectData.selectedCids.includes(category.cid);
        });
        selectData.selectedCids.sort((a, b) => a - b);
        return {
            categories: categoriesData,
            selectedCategory: selectData.selectedCategory,
            selectedCids: selectData.selectedCids,
        };
    });
}
helpers.getVisibleCategories = function (params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { cids, uid, privilege } = params;
        const states = params.states || [categories.watchStates.watching, categories.watchStates.notwatching];
        const showLinks = !!params.showLinks;
        let [allowed, watchState, categoriesData, isAdmin, isModerator] = yield Promise.all([
            privileges.categories.isUserAllowedTo(privilege, cids, uid),
            categories.getWatchState(cids, uid),
            categories.getCategoriesData(cids),
            user_1.default.isAdministrator(uid),
            user_1.default.isModerator(uid, cids),
        ]);
        const filtered = yield plugins.hooks.fire('filter:helpers.getVisibleCategories', {
            uid: uid,
            allowed: allowed,
            watchState: watchState,
            categoriesData: categoriesData,
            isModerator: isModerator,
            isAdmin: isAdmin,
        });
        ({ allowed, watchState, categoriesData, isModerator, isAdmin } = filtered);
        categories.getTree(categoriesData, params.parentCid);
        const cidToAllowed = _.zipObject(cids, allowed.map((allowed, i) => isAdmin || isModerator[i] || allowed));
        const cidToCategory = _.zipObject(cids, categoriesData);
        const cidToWatchState = _.zipObject(cids, watchState);
        return categoriesData.filter((c) => {
            if (!c) {
                return false;
            }
            const hasVisibleChildren = checkVisibleChildren(c, cidToAllowed, cidToWatchState, states);
            const isCategoryVisible = (cidToAllowed[c.cid] &&
                (showLinks || !c.link) &&
                !c.disabled &&
                states.includes(cidToWatchState[c.cid]));
            const shouldBeRemoved = !hasVisibleChildren && !isCategoryVisible;
            const shouldBeDisaplayedAsDisabled = hasVisibleChildren && !isCategoryVisible;
            if (shouldBeDisaplayedAsDisabled) {
                c.disabledClass = true;
            }
            if (shouldBeRemoved && c.parent && c.parent.cid && cidToCategory[c.parent.cid]) {
                cidToCategory[c.parent.cid].children = cidToCategory[c.parent.cid].children.filter((child) => child.cid !== c.cid);
            }
            return !shouldBeRemoved;
        });
    });
};
helpers.getSelectedCategory = function (cids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cids && !Array.isArray(cids)) {
            cids = [cids];
        }
        cids = cids && cids.map((cid) => parseInt(cid, 10));
        let selectedCategories = yield categories.getCategoriesData(cids);
        const selectedCids = selectedCategories.map((c) => c && c.cid).filter(Boolean);
        if (selectedCategories.length > 1) {
            selectedCategories = {
                icon: 'fa-plus',
                name: '[[unread:multiple-categories-selected]]',
                bgColor: '#ddd',
            };
        }
        else if (selectedCategories.length === 1 && selectedCategories[0]) {
            selectedCategories = selectedCategories[0];
        }
        else {
            selectedCategories = null;
        }
        return {
            selectedCids: selectedCids,
            selectedCategory: selectedCategories,
        };
    });
};
helpers.trimChildren = function (category) {
    if (category && Array.isArray(category.children)) {
        category.children = category.children.slice(0, category.subCategoriesPerPage);
        category.children.forEach((child) => {
            if (category.isSection) {
                helpers.trimChildren(child);
            }
            else {
                child.children = undefined;
            }
        });
    }
};
helpers.setCategoryTeaser = function (category) {
    if (Array.isArray(category.posts) && category.posts.length && category.posts[0]) {
        const post = category.posts[0];
        category.teaser = {
            url: `${nconf_1.default.get('relative_path')}/post/${post.pid}`,
            timestampISO: post.timestampISO,
            pid: post.pid,
            index: post.index,
            topic: post.topic,
            user: post.user,
        };
    }
};
function checkVisibleChildren(c, cidToAllowed, cidToWatchState, states) {
    if (!c || !Array.isArray(c.children)) {
        return false;
    }
    return c.children.some((c) => !c.disabled && ((cidToAllowed[c.cid] && states.includes(cidToWatchState[c.cid])) ||
        checkVisibleChildren(c, cidToAllowed, cidToWatchState, states)));
}
helpers.getHomePageRoutes = function (uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const routes = [
            {
                route: 'categories',
                name: 'Categories',
            },
            {
                route: 'unread',
                name: 'Unread',
            },
            {
                route: 'recent',
                name: 'Recent',
            },
            {
                route: 'top',
                name: 'Top',
            },
            {
                route: 'popular',
                name: 'Popular',
            },
            {
                route: 'custom',
                name: 'Custom',
            },
        ];
        const data = yield plugins.hooks.fire('filter:homepage.get', {
            uid: uid,
            routes: routes,
        });
        return data.routes;
    });
};
helpers.formatApiResponse = (statusCode, res, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (res.req.method === 'HEAD') {
        return res.sendStatus(statusCode);
    }
    if (String(statusCode).startsWith('2')) {
        if (res.req.loggedIn) {
            res.set('cache-control', 'private');
        }
        let code = 'ok';
        let message = 'OK';
        switch (statusCode) {
            case 202:
                code = 'accepted';
                message = 'Accepted';
                break;
            case 204:
                code = 'no-content';
                message = 'No Content';
                break;
        }
        res.status(statusCode).json({
            status: { code, message },
            response: payload || {},
        });
    }
    else if (payload instanceof Error) {
        const { message } = payload;
        const response = {};
        // Update status code based on some common error codes
        switch (message) {
            case '[[error:user-banned]]':
                Object.assign(response, yield generateBannedResponse(res));
            // intentional fall through
            case '[[error:no-privileges]]':
                statusCode = 403;
                break;
            case '[[error:invalid-uid]]':
                statusCode = 401;
                break;
        }
        if (message.startsWith('[[error:required-parameters-missing, ')) {
            const params = message.slice('[[error:required-parameters-missing, '.length, -2).split(' ');
            Object.assign(response, { params });
        }
        const returnPayload = yield helpers.generateError(statusCode, message, res);
        returnPayload.response = response;
        if (global.env === 'development') {
            returnPayload.stack = payload.stack;
            process.stdout.write(`[${chalk.yellow('api')}] Exception caught, error with stack trace follows:\n`);
            process.stdout.write(payload.stack);
        }
        res.status(statusCode).json(returnPayload);
    }
    else if (!payload) {
        // Non-2xx statusCode, generate predefined error
        const returnPayload = yield helpers.generateError(statusCode, null, res);
        res.status(statusCode).json(returnPayload);
    }
});
function generateBannedResponse(res) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = {};
        const [reason, expiry] = yield Promise.all([
            user_1.default.bans.getReason(res.req.uid),
            user_1.default.getUserField(res.req.uid, 'banned:expire'),
        ]);
        response.reason = reason;
        if (expiry) {
            Object.assign(response, {
                expiry,
                expiryISO: new Date(expiry).toISOString(),
                expiryLocaleString: new Date(expiry).toLocaleString(),
            });
        }
        return response;
    });
}
helpers.generateError = (statusCode, message, res) => __awaiter(void 0, void 0, void 0, function* () {
    function translateMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const { req } = res;
            const settings = req.query.lang ? null : yield user_1.default.getSettings(req.uid);
            const language = String(req.query.lang || settings.userLang || meta_1.default.config.defaultLang);
            return yield translator.translate(message, language);
        });
    }
    if (message && message.startsWith('[[')) {
        message = yield translateMessage(message);
    }
    const payload = {
        status: {
            code: 'internal-server-error',
            message: message || (yield translateMessage(`[[error:api.${statusCode}]]`)),
        },
        response: {},
    };
    switch (statusCode) {
        case 400:
            payload.status.code = 'bad-request';
            break;
        case 401:
            payload.status.code = 'not-authorised';
            break;
        case 403:
            payload.status.code = 'forbidden';
            break;
        case 404:
            payload.status.code = 'not-found';
            break;
        case 426:
            payload.status.code = 'upgrade-required';
            break;
        case 429:
            payload.status.code = 'too-many-requests';
            break;
        case 500:
            payload.status.code = 'internal-server-error';
            break;
        case 501:
            payload.status.code = 'not-implemented';
            break;
        case 503:
            payload.status.code = 'service-unavailable';
            break;
    }
    return payload;
});
require('../promisify').promisify(helpers);
exports.default = helpers;
