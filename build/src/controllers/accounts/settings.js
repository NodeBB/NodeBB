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
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const util = require('util');
const user_1 = __importDefault(require("../../user"));
const languages = require('../../languages');
const meta_1 = __importDefault(require("../../meta"));
const plugins = require('../../plugins');
const notifications = require('../../notifications');
const database = __importStar(require("../../database"));
const db = database;
const helpers_1 = __importDefault(require("../helpers"));
const accountHelpers = require('./helpers').defualt;
const settingsController = {};
settingsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const [settings, languagesData] = yield Promise.all([
            user_1.default.getSettings(userData.uid),
            languages.list(),
        ]);
        userData.settings = settings;
        userData.languages = languagesData;
        if (userData.isAdmin && userData.isSelf) {
            userData.acpLanguages = _.cloneDeep(languagesData);
        }
        const data = yield plugins.hooks.fire('filter:user.customSettings', {
            settings: settings,
            customSettings: [],
            uid: req.uid,
        });
        const [notificationSettings, routes] = yield Promise.all([
            getNotificationSettings(userData),
            getHomePageRoutes(userData),
        ]);
        userData.customSettings = data.customSettings;
        userData.homePageRoutes = routes;
        userData.notificationSettings = notificationSettings;
        userData.disableEmailSubscriptions = meta_1.default.config.disableEmailSubscriptions;
        userData.dailyDigestFreqOptions = [
            { value: 'off', name: '[[user:digest_off]]', selected: userData.settings.dailyDigestFreq === 'off' },
            { value: 'day', name: '[[user:digest_daily]]', selected: userData.settings.dailyDigestFreq === 'day' },
            { value: 'week', name: '[[user:digest_weekly]]', selected: userData.settings.dailyDigestFreq === 'week' },
            { value: 'biweek', name: '[[user:digest_biweekly]]', selected: userData.settings.dailyDigestFreq === 'biweek' },
            { value: 'month', name: '[[user:digest_monthly]]', selected: userData.settings.dailyDigestFreq === 'month' },
        ];
        userData.bootswatchSkinOptions = [
            { name: 'Default', value: '' },
        ];
        userData.bootswatchSkinOptions.push(...meta_1.default.css.supportedSkins.map((skin) => ({ name: _.capitalize(skin), value: skin })));
        userData.bootswatchSkinOptions.forEach((skin) => {
            skin.selected = skin.value === userData.settings.bootswatchSkin;
        });
        userData.languages.forEach((language) => {
            language.selected = language.code === userData.settings.userLang;
        });
        if (userData.isAdmin && userData.isSelf) {
            userData.acpLanguages.forEach((language) => {
                language.selected = language.code === userData.settings.acpLang;
            });
        }
        const notifFreqOptions = [
            'all',
            'first',
            'everyTen',
            'threshold',
            'logarithmic',
            'disabled',
        ];
        userData.upvoteNotifFreq = notifFreqOptions.map(name => ({ name: name, selected: name === userData.settings.upvoteNotifFreq }));
        userData.categoryWatchState = { [userData.settings.categoryWatchState]: true };
        userData.disableCustomUserSkins = meta_1.default.config.disableCustomUserSkins || 0;
        userData.allowUserHomePage = meta_1.default.config.allowUserHomePage === 1 ? 1 : 0;
        userData.hideFullname = meta_1.default.config.hideFullname || 0;
        userData.hideEmail = meta_1.default.config.hideEmail || 0;
        userData.inTopicSearchAvailable = plugins.hooks.hasListeners('filter:topic.search');
        userData.maxTopicsPerPage = meta_1.default.config.maxTopicsPerPage;
        userData.maxPostsPerPage = meta_1.default.config.maxPostsPerPage;
        userData.title = '[[pages:account/settings]]';
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[user:settings]]' }]);
        res.render('account/settings', userData);
    });
};
const unsubscribable = ['digest', 'notification'];
const jwtVerifyAsync = util.promisify((token, callback) => {
    jwt.verify(token, nconf_1.default.get('secret'), (err, payload) => callback(err, payload));
});
const doUnsubscribe = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.template === 'digest') {
        yield Promise.all([
            user_1.default.setSetting(payload.uid, 'dailyDigestFreq', 'off'),
            user_1.default.updateDigestSetting(payload.uid, 'off'),
        ]);
    }
    else if (payload.template === 'notification') {
        const current = yield db.getObjectField(`user:${payload.uid}:settings`, `notificationType_${payload.type}`);
        yield user_1.default.setSetting(payload.uid, `notificationType_${payload.type}`, (current === 'notificationemail' ? 'notification' : 'none'));
    }
    return true;
});
settingsController.unsubscribe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = yield jwtVerifyAsync(req.params.token);
        if (!payload || !unsubscribable.includes(payload.template)) {
            return;
        }
        yield doUnsubscribe(payload);
        res.render('unsubscribe', {
            payload,
        });
    }
    catch (err) {
        res.render('unsubscribe', {
            error: err.message,
        });
    }
});
settingsController.unsubscribePost = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let payload;
        try {
            payload = yield jwtVerifyAsync(req.params.token);
            if (!payload || !unsubscribable.includes(payload.template)) {
                return res.sendStatus(404);
            }
        }
        catch (err) {
            return res.sendStatus(403);
        }
        try {
            yield doUnsubscribe(payload);
            res.sendStatus(200);
        }
        catch (err) {
            winston_1.default.error(`[settings/unsubscribe] One-click unsubscribe failed with error: ${err.message}`);
            res.sendStatus(500);
        }
    });
};
function getNotificationSettings(userData) {
    return __awaiter(this, void 0, void 0, function* () {
        const privilegedTypes = [];
        const privileges = yield user_1.default.getPrivileges(userData.uid);
        if (privileges.isAdmin) {
            privilegedTypes.push('notificationType_new-register');
        }
        if (privileges.isAdmin || privileges.isGlobalMod || privileges.isModeratorOfAnyCategory) {
            privilegedTypes.push('notificationType_post-queue', 'notificationType_new-post-flag');
        }
        if (privileges.isAdmin || privileges.isGlobalMod) {
            privilegedTypes.push('notificationType_new-user-flag');
        }
        const results = yield plugins.hooks.fire('filter:user.notificationTypes', {
            types: notifications.baseTypes.slice(),
            privilegedTypes: privilegedTypes,
        });
        function modifyType(type) {
            const setting = userData.settings[type];
            return {
                name: type,
                label: `[[notifications:${type}]]`,
                none: setting === 'none',
                notification: setting === 'notification',
                email: setting === 'email',
                notificationemail: setting === 'notificationemail',
            };
        }
        if (meta_1.default.config.disableChat) {
            results.types = results.types.filter((type) => type !== 'notificationType_new-chat');
        }
        return results.types.map(modifyType).concat(results.privilegedTypes.map(modifyType));
    });
}
function getHomePageRoutes(userData) {
    return __awaiter(this, void 0, void 0, function* () {
        let routes = yield helpers_1.default.getHomePageRoutes(userData.uid);
        // Set selected for each route
        let customIdx;
        let hasSelected = false;
        routes = routes.map((route, idx) => {
            if (route.route === userData.settings.homePageRoute) {
                route.selected = true;
                hasSelected = true;
            }
            else {
                route.selected = false;
            }
            if (route.route === 'custom') {
                customIdx = idx;
            }
            return route;
        });
        if (!hasSelected && customIdx && userData.settings.homePageRoute !== 'none') {
            routes[customIdx].selected = true;
        }
        return routes;
    });
}
