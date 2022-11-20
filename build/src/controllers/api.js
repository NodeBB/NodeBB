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
const nconf_1 = __importDefault(require("nconf"));
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const categories = require('../categories');
const plugins = require('../plugins');
const translator = require('../translator');
const languages = require('../languages');
const apiController = {};
const relative_path = nconf_1.default.get('relative_path');
const upload_url = nconf_1.default.get('upload_url');
const asset_base_url = nconf_1.default.get('asset_base_url');
const socketioTransports = nconf_1.default.get('socket.io:transports') || ['polling', 'websocket'];
const socketioOrigins = nconf_1.default.get('socket.io:origins');
const websocketAddress = nconf_1.default.get('socket.io:address') || '';
apiController.loadConfig = function (req) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = {
            relative_path,
            upload_url,
            asset_base_url,
            assetBaseUrl: asset_base_url,
            siteTitle: validator.escape(String(meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB')),
            browserTitle: validator.escape(String(meta_1.default.config.browserTitle || meta_1.default.config.title || 'NodeBB')),
            titleLayout: (meta_1.default.config.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;'),
            showSiteTitle: meta_1.default.config.showSiteTitle === 1,
            maintenanceMode: meta_1.default.config.maintenanceMode === 1,
            minimumTitleLength: meta_1.default.config.minimumTitleLength,
            maximumTitleLength: meta_1.default.config.maximumTitleLength,
            minimumPostLength: meta_1.default.config.minimumPostLength,
            maximumPostLength: meta_1.default.config.maximumPostLength,
            minimumTagsPerTopic: meta_1.default.config.minimumTagsPerTopic || 0,
            maximumTagsPerTopic: meta_1.default.config.maximumTagsPerTopic || 5,
            minimumTagLength: meta_1.default.config.minimumTagLength || 3,
            maximumTagLength: meta_1.default.config.maximumTagLength || 15,
            undoTimeout: meta_1.default.config.undoTimeout || 0,
            useOutgoingLinksPage: meta_1.default.config.useOutgoingLinksPage === 1,
            outgoingLinksWhitelist: meta_1.default.config.useOutgoingLinksPage === 1 ? meta_1.default.config['outgoingLinks:whitelist'] : undefined,
            allowGuestHandles: meta_1.default.config.allowGuestHandles === 1,
            allowTopicsThumbnail: meta_1.default.config.allowTopicsThumbnail === 1,
            usePagination: meta_1.default.config.usePagination === 1,
            disableChat: meta_1.default.config.disableChat === 1,
            disableChatMessageEditing: meta_1.default.config.disableChatMessageEditing === 1,
            maximumChatMessageLength: meta_1.default.config.maximumChatMessageLength || 1000,
            socketioTransports,
            socketioOrigins,
            websocketAddress,
            maxReconnectionAttempts: meta_1.default.config.maxReconnectionAttempts,
            reconnectionDelay: meta_1.default.config.reconnectionDelay,
            topicsPerPage: meta_1.default.config.topicsPerPage || 20,
            postsPerPage: meta_1.default.config.postsPerPage || 20,
            maximumFileSize: meta_1.default.config.maximumFileSize,
            'theme:id': meta_1.default.config['theme:id'],
            'theme:src': meta_1.default.config['theme:src'],
            defaultLang: meta_1.default.config.defaultLang || 'en-GB',
            userLang: req.query.lang ? validator.escape(String(req.query.lang)) : (meta_1.default.config.defaultLang || 'en-GB'),
            loggedIn: !!req.user,
            uid: req.uid,
            'cache-buster': meta_1.default.config['cache-buster'] || '',
            topicPostSort: meta_1.default.config.topicPostSort || 'oldest_to_newest',
            categoryTopicSort: meta_1.default.config.categoryTopicSort || 'newest_to_oldest',
            csrf_token: req.uid >= 0 && req.csrfToken && req.csrfToken(),
            searchEnabled: plugins.hooks.hasListeners('filter:search.query'),
            searchDefaultInQuick: meta_1.default.config.searchDefaultInQuick || 'titles',
            bootswatchSkin: meta_1.default.config.bootswatchSkin || '',
            enablePostHistory: meta_1.default.config.enablePostHistory === 1,
            timeagoCutoff: meta_1.default.config.timeagoCutoff !== '' ? Math.max(0, parseInt(meta_1.default.config.timeagoCutoff, 10)) : meta_1.default.config.timeagoCutoff,
            timeagoCodes: languages.timeagoCodes,
            cookies: {
                enabled: meta_1.default.config.cookieConsentEnabled === 1,
                message: translator.escape(validator.escape(meta_1.default.config.cookieConsentMessage || '[[global:cookies.message]]')).replace(/\\/g, '\\\\'),
                dismiss: translator.escape(validator.escape(meta_1.default.config.cookieConsentDismiss || '[[global:cookies.accept]]')).replace(/\\/g, '\\\\'),
                link: translator.escape(validator.escape(meta_1.default.config.cookieConsentLink || '[[global:cookies.learn_more]]')).replace(/\\/g, '\\\\'),
                link_url: translator.escape(validator.escape(meta_1.default.config.cookieConsentLinkUrl || 'https://www.cookiesandyou.com')).replace(/\\/g, '\\\\'),
            },
            thumbs: {
                size: meta_1.default.config.topicThumbSize,
            },
            iconBackgrounds: yield user_1.default.getIconBackgrounds(req.uid),
            emailPrompt: meta_1.default.config.emailPrompt,
            useragent: req.useragent,
        };
        let settings = config;
        let isAdminOrGlobalMod;
        if (req.loggedIn) {
            ([settings, isAdminOrGlobalMod] = yield Promise.all([
                user_1.default.getSettings(req.uid),
                user_1.default.isAdminOrGlobalMod(req.uid),
            ]));
        }
        // Handle old skin configs
        const oldSkins = ['noskin', 'default'];
        settings.bootswatchSkin = oldSkins.includes(settings.bootswatchSkin) ? '' : settings.bootswatchSkin;
        config.usePagination = settings.usePagination;
        config.topicsPerPage = settings.topicsPerPage;
        config.postsPerPage = settings.postsPerPage;
        config.userLang = validator.escape(String((req.query.lang ? req.query.lang : null) || settings.userLang || config.defaultLang));
        config.acpLang = validator.escape(String((req.query.lang ? req.query.lang : null) || settings.acpLang));
        config.openOutgoingLinksInNewTab = settings.openOutgoingLinksInNewTab;
        config.topicPostSort = settings.topicPostSort || config.topicPostSort;
        config.categoryTopicSort = settings.categoryTopicSort || config.categoryTopicSort;
        config.topicSearchEnabled = settings.topicSearchEnabled || false;
        config.bootswatchSkin = (meta_1.default.config.disableCustomUserSkins !== 1 && settings.bootswatchSkin && settings.bootswatchSkin !== '') ? settings.bootswatchSkin : '';
        // Overrides based on privilege
        config.disableChatMessageEditing = isAdminOrGlobalMod ? false : config.disableChatMessageEditing;
        return yield plugins.hooks.fire('filter:config.get', config);
    });
};
apiController.getConfig = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield apiController.loadConfig(req);
        res.json(config);
    });
};
apiController.getModerators = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const moderators = yield categories.getModerators(req.params.cid);
        res.json({ moderators: moderators });
    });
};
require('../promisify').promisify(apiController, ['getConfig', 'getObject', 'getModerators']);
