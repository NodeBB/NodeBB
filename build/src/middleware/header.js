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
const jsesc = require('jsesc');
const _ = require('lodash');
const validator = require('validator');
const util = require('util');
const user_1 = __importDefault(require("../user"));
const topics = require('../topics');
const messaging = require('../messaging');
const flags = require('../flags');
const meta_1 = __importDefault(require("../meta"));
const plugins = require('../plugins');
const navigation = require('../navigation');
const translator = require('../translator');
const privileges = require('../privileges');
const languages = require('../languages');
const utils = require('../utils');
const helpers = require('./helpers').default;
console.log('HELPERS,,,', helpers);
const controllers = {
    api: require('../controllers/api'),
    helpers: require('../controllers/helpers'),
};
const middleware = {};
const relative_path = nconf_1.default.get('relative_path');
middleware.buildHeader = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    res.locals.renderHeader = true;
    res.locals.isAPI = false;
    if (req.method === 'GET') {
        yield require('./index').applyCSRFasync(req, res);
    }
    const [config, canLoginIfBanned] = yield Promise.all([
        controllers.api.loadConfig(req),
        user_1.default.bans.canLoginIfBanned(req.uid),
        plugins.hooks.fire('filter:middleware.buildHeader', { req: req, locals: res.locals }),
    ]);
    if (!canLoginIfBanned && req.loggedIn) {
        req.logout(() => {
            res.redirect('/');
        });
        return;
    }
    res.locals.config = config;
    next();
}));
middleware.buildHeaderAsync = util.promisify(middleware.buildHeader);
middleware.renderHeader = function renderHeader(req, res, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const registrationType = meta_1.default.config.registrationType || 'normal';
        res.locals.config = res.locals.config || {};
        const templateValues = {
            title: meta_1.default.config.title || '',
            'title:url': meta_1.default.config['title:url'] || '',
            description: meta_1.default.config.description || '',
            'cache-buster': meta_1.default.config['cache-buster'] || '',
            'brand:logo': meta_1.default.config['brand:logo'] || '',
            'brand:logo:url': meta_1.default.config['brand:logo:url'] || '',
            'brand:logo:alt': meta_1.default.config['brand:logo:alt'] || '',
            'brand:logo:display': meta_1.default.config['brand:logo'] ? '' : 'hide',
            allowRegistration: registrationType === 'normal',
            searchEnabled: plugins.hooks.hasListeners('filter:search.query'),
            postQueueEnabled: !!meta_1.default.config.postQueue,
            config: res.locals.config,
            relative_path,
            bodyClass: data.bodyClass,
        };
        templateValues.configJSON = jsesc(JSON.stringify(res.locals.config), { isScriptContext: true });
        const results = yield utils.promiseParallel({
            isAdmin: user_1.default.isAdministrator(req.uid),
            isGlobalMod: user_1.default.isGlobalModerator(req.uid),
            isModerator: user_1.default.isModeratorOfAnyCategory(req.uid),
            privileges: privileges.global.get(req.uid),
            user: user_1.default.getUserData(req.uid),
            isEmailConfirmSent: req.uid <= 0 ? false : yield user_1.default.email.isValidationPending(req.uid),
            languageDirection: translator.translate('[[language:dir]]', res.locals.config.userLang),
            timeagoCode: languages.userTimeagoCode(res.locals.config.userLang),
            browserTitle: translator.translate(controllers.helpers.buildTitle(translator.unescape(data.title))),
            navigation: navigation.get(req.uid),
        });
        const unreadData = {
            '': {},
            new: {},
            watched: {},
            unreplied: {},
        };
        results.user.unreadData = unreadData;
        results.user.isAdmin = results.isAdmin;
        results.user.isGlobalMod = results.isGlobalMod;
        results.user.isMod = !!results.isModerator;
        results.user.privileges = results.privileges;
        results.user.timeagoCode = results.timeagoCode;
        results.user[results.user.status] = true;
        results.user.email = String(results.user.email);
        results.user['email:confirmed'] = results.user['email:confirmed'] === 1;
        results.user.isEmailConfirmSent = !!results.isEmailConfirmSent;
        templateValues.bootswatchSkin = (parseInt(meta_1.default.config.disableCustomUserSkins, 10) !== 1 ? res.locals.config.bootswatchSkin : '') || meta_1.default.config.bootswatchSkin || '';
        templateValues.browserTitle = results.browserTitle;
        ({
            navigation: templateValues.navigation,
            unreadCount: templateValues.unreadCount,
        } = yield appendUnreadCounts({
            uid: req.uid,
            query: req.query,
            navigation: results.navigation,
            unreadData,
        }));
        templateValues.isAdmin = results.user.isAdmin;
        templateValues.isGlobalMod = results.user.isGlobalMod;
        templateValues.showModMenu = results.user.isAdmin || results.user.isGlobalMod || results.user.isMod;
        templateValues.canChat = results.privileges.chat && meta_1.default.config.disableChat !== 1;
        templateValues.user = results.user;
        templateValues.userJSON = jsesc(JSON.stringify(results.user), { isScriptContext: true });
        templateValues.useCustomCSS = meta_1.default.config.useCustomCSS && meta_1.default.config.customCSS;
        templateValues.customCSS = templateValues.useCustomCSS ? (meta_1.default.config.renderedCustomCSS || '') : '';
        templateValues.useCustomHTML = meta_1.default.config.useCustomHTML;
        templateValues.customHTML = templateValues.useCustomHTML ? meta_1.default.config.customHTML : '';
        templateValues.maintenanceHeader = meta_1.default.config.maintenanceMode && !results.isAdmin;
        templateValues.defaultLang = meta_1.default.config.defaultLang || 'en-GB';
        templateValues.userLang = res.locals.config.userLang;
        templateValues.languageDirection = results.languageDirection;
        if (req.query.noScriptMessage) {
            templateValues.noScriptMessage = validator.escape(String(req.query.noScriptMessage));
        }
        templateValues.template = { name: res.locals.template };
        templateValues.template[res.locals.template] = true;
        if (data.hasOwnProperty('_header')) {
            templateValues.metaTags = data._header.tags.meta;
            templateValues.linkTags = data._header.tags.link;
        }
        if (req.route && req.route.path === '/') {
            modifyTitle(templateValues);
        }
        const hookReturn = yield plugins.hooks.fire('filter:middleware.renderHeader', {
            req: req,
            res: res,
            templateValues: templateValues,
            templateData: templateValues,
            data: data,
        });
        return yield req.app.renderAsync('header', hookReturn.templateValues);
    });
};
function appendUnreadCounts({ uid, navigation, unreadData, query }) {
    return __awaiter(this, void 0, void 0, function* () {
        const originalRoutes = navigation.map(nav => nav.originalRoute);
        const calls = {
            unreadData: topics.getUnreadData({ uid: uid, query: query }),
            unreadChatCount: messaging.getUnreadCount(uid),
            unreadNotificationCount: user_1.default.notifications.getUnreadCount(uid),
            unreadFlagCount: (function () {
                return __awaiter(this, void 0, void 0, function* () {
                    if (originalRoutes.includes('/flags') && (yield user_1.default.isPrivileged(uid))) {
                        return flags.getCount({
                            uid,
                            query,
                            filters: {
                                quick: 'unresolved',
                                cid: (yield user_1.default.isAdminOrGlobalMod(uid)) ? [] : (yield user_1.default.getModeratedCids(uid)),
                            },
                        });
                    }
                    return 0;
                });
            }()),
        };
        const results = yield utils.promiseParallel(calls);
        const unreadCounts = results.unreadData.counts;
        const unreadCount = {
            topic: unreadCounts[''] || 0,
            newTopic: unreadCounts.new || 0,
            watchedTopic: unreadCounts.watched || 0,
            unrepliedTopic: unreadCounts.unreplied || 0,
            mobileUnread: 0,
            unreadUrl: '/unread',
            chat: results.unreadChatCount || 0,
            notification: results.unreadNotificationCount || 0,
            flags: results.unreadFlagCount || 0,
        };
        Object.keys(unreadCount).forEach((key) => {
            if (unreadCount[key] > 99) {
                unreadCount[key] = '99+';
            }
        });
        const { tidsByFilter } = results.unreadData;
        navigation = navigation.map((item) => {
            function modifyNavItem(item, route, filter, content) {
                if (item && item.originalRoute === route) {
                    unreadData[filter] = _.zipObject(tidsByFilter[filter], tidsByFilter[filter].map(() => true));
                    item.content = content;
                    unreadCount.mobileUnread = content;
                    unreadCount.unreadUrl = route;
                    if (unreadCounts[filter] > 0) {
                        item.iconClass += ' unread-count';
                    }
                }
            }
            modifyNavItem(item, '/unread', '', unreadCount.topic);
            modifyNavItem(item, '/unread?filter=new', 'new', unreadCount.newTopic);
            modifyNavItem(item, '/unread?filter=watched', 'watched', unreadCount.watchedTopic);
            modifyNavItem(item, '/unread?filter=unreplied', 'unreplied', unreadCount.unrepliedTopic);
            ['flags'].forEach((prop) => {
                if (item && item.originalRoute === `/${prop}` && unreadCount[prop] > 0) {
                    item.iconClass += ' unread-count';
                    item.content = unreadCount.flags;
                }
            });
            return item;
        });
        return { navigation, unreadCount };
    });
}
middleware.renderFooter = function renderFooter(req, res, templateValues) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield plugins.hooks.fire('filter:middleware.renderFooter', {
            req: req,
            res: res,
            templateValues: templateValues,
            templateData: templateValues,
        });
        const scripts = yield plugins.hooks.fire('filter:scripts.get', []);
        data.templateValues.scripts = scripts.map(script => ({ src: script }));
        data.templateValues.useCustomJS = meta_1.default.config.useCustomJS;
        data.templateValues.customJS = data.templateValues.useCustomJS ? meta_1.default.config.customJS : '';
        data.templateValues.isSpider = req.uid === -1;
        return yield req.app.renderAsync('footer', data.templateValues);
    });
};
function modifyTitle(obj) {
    const title = controllers.helpers.buildTitle(meta_1.default.config.homePageTitle || '[[pages:home]]');
    obj.browserTitle = title;
    if (obj.metaTags) {
        obj.metaTags.forEach((tag, i) => {
            if (tag.property === 'og:title') {
                obj.metaTags[i].content = title;
            }
        });
    }
    return title;
}
exports.default = middleware;
