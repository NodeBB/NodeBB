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
const meta_1 = __importDefault(require("../meta"));
const database_1 = __importDefault(require("../database"));
const plugins = require('../plugins');
const notifications = require('../notifications');
const languages = require('../languages');
function default_1(User) {
    User.getSettings = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return yield onSettingsLoaded(0, {});
            }
            let settings = yield database_1.default.getObject(`user:${uid}:settings`);
            settings = settings || {};
            settings.uid = uid;
            return yield onSettingsLoaded(uid, settings);
        });
    };
    User.getMultipleUserSettings = function (uids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(uids) || !uids.length) {
                return [];
            }
            const keys = uids.map(uid => `user:${uid}:settings`);
            let settings = yield database_1.default.getObjects(keys);
            settings = settings.map((userSettings, index) => {
                userSettings = userSettings || {};
                userSettings.uid = uids[index];
                return userSettings;
            });
            return yield Promise.all(settings.map(s => onSettingsLoaded(s.uid, s)));
        });
    };
    function onSettingsLoaded(uid, settings) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield plugins.hooks.fire('filter:user.getSettings', { uid: uid, settings: settings });
            settings = data.settings;
            const defaultTopicsPerPage = meta_1.default.config.topicsPerPage;
            const defaultPostsPerPage = meta_1.default.config.postsPerPage;
            settings.showemail = parseInt(getSetting(settings, 'showemail', 0), 10) === 1;
            settings.showfullname = parseInt(getSetting(settings, 'showfullname', 0), 10) === 1;
            settings.openOutgoingLinksInNewTab = parseInt(getSetting(settings, 'openOutgoingLinksInNewTab', 0), 10) === 1;
            settings.dailyDigestFreq = getSetting(settings, 'dailyDigestFreq', 'off');
            settings.usePagination = parseInt(getSetting(settings, 'usePagination', 0), 10) === 1;
            settings.topicsPerPage = Math.min(meta_1.default.config.maxTopicsPerPage, settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : defaultTopicsPerPage, defaultTopicsPerPage);
            settings.postsPerPage = Math.min(meta_1.default.config.maxPostsPerPage, settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : defaultPostsPerPage, defaultPostsPerPage);
            settings.userLang = settings.userLang || meta_1.default.config.defaultLang || 'en-GB';
            settings.acpLang = settings.acpLang || settings.userLang;
            settings.topicPostSort = getSetting(settings, 'topicPostSort', 'oldest_to_newest');
            settings.categoryTopicSort = getSetting(settings, 'categoryTopicSort', 'newest_to_oldest');
            settings.followTopicsOnCreate = parseInt(getSetting(settings, 'followTopicsOnCreate', 1), 10) === 1;
            settings.followTopicsOnReply = parseInt(getSetting(settings, 'followTopicsOnReply', 0), 10) === 1;
            settings.upvoteNotifFreq = getSetting(settings, 'upvoteNotifFreq', 'all');
            settings.restrictChat = parseInt(getSetting(settings, 'restrictChat', 0), 10) === 1;
            settings.topicSearchEnabled = parseInt(getSetting(settings, 'topicSearchEnabled', 0), 10) === 1;
            settings.updateUrlWithPostIndex = parseInt(getSetting(settings, 'updateUrlWithPostIndex', 1), 10) === 1;
            settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));
            settings.homePageRoute = validator.escape(String(settings.homePageRoute || '')).replace(/&#x2F;/g, '/');
            settings.scrollToMyPost = parseInt(getSetting(settings, 'scrollToMyPost', 1), 10) === 1;
            settings.categoryWatchState = getSetting(settings, 'categoryWatchState', 'notwatching');
            const notificationTypes = yield notifications.getAllNotificationTypes();
            notificationTypes.forEach((notificationType) => {
                settings[notificationType] = getSetting(settings, notificationType, 'notification');
            });
            return settings;
        });
    }
    function getSetting(settings, key, defaultValue) {
        if (settings[key] || settings[key] === 0) {
            return settings[key];
        }
        else if (meta_1.default.config[key] || meta_1.default.config[key] === 0) {
            return meta_1.default.config[key];
        }
        return defaultValue;
    }
    User.saveSettings = function (uid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxPostsPerPage = meta_1.default.config.maxPostsPerPage || 20;
            if (!data.postsPerPage ||
                parseInt(data.postsPerPage, 10) <= 1 ||
                parseInt(data.postsPerPage, 10) > maxPostsPerPage) {
                throw new Error(`[[error:invalid-pagination-value, 2, ${maxPostsPerPage}]]`);
            }
            const maxTopicsPerPage = meta_1.default.config.maxTopicsPerPage || 20;
            if (!data.topicsPerPage ||
                parseInt(data.topicsPerPage, 10) <= 1 ||
                parseInt(data.topicsPerPage, 10) > maxTopicsPerPage) {
                throw new Error(`[[error:invalid-pagination-value, 2, ${maxTopicsPerPage}]]`);
            }
            const languageCodes = yield languages.listCodes();
            if (data.userLang && !languageCodes.includes(data.userLang)) {
                throw new Error('[[error:invalid-language]]');
            }
            if (data.acpLang && !languageCodes.includes(data.acpLang)) {
                throw new Error('[[error:invalid-language]]');
            }
            data.userLang = data.userLang || meta_1.default.config.defaultLang;
            plugins.hooks.fire('action:user.saveSettings', { uid: uid, settings: data });
            const settings = {
                showemail: data.showemail,
                showfullname: data.showfullname,
                openOutgoingLinksInNewTab: data.openOutgoingLinksInNewTab,
                dailyDigestFreq: data.dailyDigestFreq || 'off',
                usePagination: data.usePagination,
                topicsPerPage: Math.min(data.topicsPerPage, parseInt(maxTopicsPerPage, 10) || 20),
                postsPerPage: Math.min(data.postsPerPage, parseInt(maxPostsPerPage, 10) || 20),
                userLang: data.userLang || meta_1.default.config.defaultLang,
                acpLang: data.acpLang || meta_1.default.config.defaultLang,
                followTopicsOnCreate: data.followTopicsOnCreate,
                followTopicsOnReply: data.followTopicsOnReply,
                restrictChat: data.restrictChat,
                topicSearchEnabled: data.topicSearchEnabled,
                updateUrlWithPostIndex: data.updateUrlWithPostIndex,
                homePageRoute: ((data.homePageRoute === 'custom' ? data.homePageCustom : data.homePageRoute) || '').replace(/^\//, ''),
                scrollToMyPost: data.scrollToMyPost,
                upvoteNotifFreq: data.upvoteNotifFreq,
                bootswatchSkin: data.bootswatchSkin,
                categoryWatchState: data.categoryWatchState,
                categoryTopicSort: data.categoryTopicSort,
                topicPostSort: data.topicPostSort,
            };
            const notificationTypes = yield notifications.getAllNotificationTypes();
            notificationTypes.forEach((notificationType) => {
                if (data[notificationType]) {
                    settings[notificationType] = data[notificationType];
                }
            });
            const result = yield plugins.hooks.fire('filter:user.saveSettings', { uid: uid, settings: settings, data: data });
            yield database_1.default.setObject(`user:${uid}:settings`, result.settings);
            yield User.updateDigestSetting(uid, data.dailyDigestFreq);
            return yield User.getSettings(uid);
        });
    };
    User.updateDigestSetting = function (uid, dailyDigestFreq) {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.default.sortedSetsRemove(['digest:day:uids', 'digest:week:uids', 'digest:month:uids'], uid);
            if (['day', 'week', 'biweek', 'month'].includes(dailyDigestFreq)) {
                yield database_1.default.sortedSetAdd(`digest:${dailyDigestFreq}:uids`, Date.now(), uid);
            }
        });
    };
    User.setSetting = function (uid, key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return;
            }
            yield database_1.default.setObjectField(`user:${uid}:settings`, key, value);
        });
    };
}
exports.default = default_1;
;
