'use strict';

const validator = require('validator');
const nconf = require('nconf');

const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const plugins = require('../plugins');
const translator = require('../translator');
const languages = require('../languages');
const { generateToken } = require('../middleware/csrf');
const utils = require('../utils');

const apiController = module.exports;

const relative_path = nconf.get('relative_path');
const upload_url = nconf.get('upload_url');
const asset_base_url = nconf.get('asset_base_url');
const socketioTransports = nconf.get('socket.io:transports') || ['polling', 'websocket'];
const socketioOrigins = nconf.get('socket.io:origins');
const websocketAddress = nconf.get('socket.io:address') || '';
const fontawesome_pro = nconf.get('fontawesome:pro') || false;
const fontawesome_styles = utils.getFontawesomeStyles();
const fontawesome_version = utils.getFontawesomeVersion();

apiController.loadConfig = async function (req) {
	const config = {
		relative_path,
		upload_url,
		asset_base_url,
		assetBaseUrl: asset_base_url, // deprecate in 1.20.x
		siteTitle: validator.escape(String(meta.config.title || meta.config.browserTitle || 'NodeBB')),
		browserTitle: validator.escape(String(meta.config.browserTitle || meta.config.title || 'NodeBB')),
		titleLayout: (meta.config.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;'),
		showSiteTitle: meta.config.showSiteTitle === 1,
		maintenanceMode: meta.config.maintenanceMode === 1,
		postQueue: meta.config.postQueue,
		minimumTitleLength: meta.config.minimumTitleLength,
		maximumTitleLength: meta.config.maximumTitleLength,
		minimumPostLength: meta.config.minimumPostLength,
		maximumPostLength: meta.config.maximumPostLength,
		minimumTagsPerTopic: meta.config.minimumTagsPerTopic || 0,
		maximumTagsPerTopic: meta.config.maximumTagsPerTopic || 5,
		minimumTagLength: meta.config.minimumTagLength || 3,
		maximumTagLength: meta.config.maximumTagLength || 15,
		undoTimeout: meta.config.undoTimeout || 0,
		useOutgoingLinksPage: meta.config.useOutgoingLinksPage === 1,
		outgoingLinksWhitelist: meta.config.useOutgoingLinksPage === 1 ? meta.config['outgoingLinks:whitelist'] : undefined,
		allowGuestHandles: meta.config.allowGuestHandles === 1,
		allowTopicsThumbnail: meta.config.allowTopicsThumbnail === 1,
		usePagination: meta.config.usePagination === 1,
		disableChat: meta.config.disableChat === 1,
		disableChatMessageEditing: meta.config.disableChatMessageEditing === 1,
		maximumChatMessageLength: meta.config.maximumChatMessageLength || 1000,
		socketioTransports,
		socketioOrigins,
		websocketAddress,
		maxReconnectionAttempts: meta.config.maxReconnectionAttempts,
		reconnectionDelay: meta.config.reconnectionDelay,
		topicsPerPage: meta.config.topicsPerPage || 20,
		postsPerPage: meta.config.postsPerPage || 20,
		maximumFileSize: meta.config.maximumFileSize,
		'theme:id': meta.config['theme:id'],
		'theme:src': meta.config['theme:src'],
		defaultLang: meta.config.defaultLang || 'en-GB',
		userLang: req.query.lang ? validator.escape(String(req.query.lang)) : (meta.config.defaultLang || 'en-GB'),
		loggedIn: !!req.user,
		uid: req.uid,
		'cache-buster': meta.config['cache-buster'] || '',
		topicPostSort: meta.config.topicPostSort || 'oldest_to_newest',
		categoryTopicSort: meta.config.categoryTopicSort || 'recently_replied',
		csrf_token: req.uid >= 0 ? generateToken(req) : false,
		searchEnabled: plugins.hooks.hasListeners('filter:search.query'),
		searchDefaultInQuick: meta.config.searchDefaultInQuick || 'titles',
		bootswatchSkin: meta.config.bootswatchSkin || '',
		'composer:showHelpTab': meta.config['composer:showHelpTab'] === 1,
		enablePostHistory: meta.config.enablePostHistory === 1,
		timeagoCutoff: meta.config.timeagoCutoff !== '' ? Math.max(0, parseInt(meta.config.timeagoCutoff, 10)) : meta.config.timeagoCutoff,
		timeagoCodes: languages.timeagoCodes,
		cookies: {
			enabled: meta.config.cookieConsentEnabled === 1,
			message: translator.escape(validator.escape(meta.config.cookieConsentMessage || '[[global:cookies.message]]')).replace(/\\/g, '\\\\'),
			dismiss: translator.escape(validator.escape(meta.config.cookieConsentDismiss || '[[global:cookies.accept]]')).replace(/\\/g, '\\\\'),
			link: translator.escape(validator.escape(meta.config.cookieConsentLink || '[[global:cookies.learn-more]]')).replace(/\\/g, '\\\\'),
			link_url: translator.escape(validator.escape(meta.config.cookieConsentLinkUrl || 'https://www.cookiesandyou.com')).replace(/\\/g, '\\\\'),
		},
		thumbs: {
			size: meta.config.topicThumbSize,
		},
		emailPrompt: meta.config.emailPrompt,
		useragent: {
			isSafari: req.useragent.isSafari,
		},
		fontawesome: {
			pro: fontawesome_pro,
			styles: fontawesome_styles,
			version: fontawesome_version,
		},
	};

	let settings = config;
	let isAdminOrGlobalMod;
	if (req.loggedIn) {
		([settings, isAdminOrGlobalMod] = await Promise.all([
			user.getSettings(req.uid),
			user.isAdminOrGlobalMod(req.uid),
		]));
	}

	// Handle old skin configs
	const oldSkins = ['default'];
	settings.bootswatchSkin = oldSkins.includes(settings.bootswatchSkin) ? '' : settings.bootswatchSkin;

	config.usePagination = settings.usePagination;
	config.topicsPerPage = settings.topicsPerPage;
	config.postsPerPage = settings.postsPerPage;
	config.userLang = validator.escape(
		String((req.query.lang ? req.query.lang : null) || settings.userLang || config.defaultLang)
	);
	config.acpLang = validator.escape(String((req.query.lang ? req.query.lang : null) || settings.acpLang));
	config.openOutgoingLinksInNewTab = settings.openOutgoingLinksInNewTab;
	config.topicPostSort = settings.topicPostSort || config.topicPostSort;
	config.categoryTopicSort = settings.categoryTopicSort || config.categoryTopicSort;
	config.topicSearchEnabled = settings.topicSearchEnabled || false;
	config.disableCustomUserSkins = meta.config.disableCustomUserSkins === 1;
	config.defaultBootswatchSkin = config.bootswatchSkin;
	if (!config.disableCustomUserSkins && settings.bootswatchSkin) {
		if (settings.bootswatchSkin === 'noskin') {
			config.bootswatchSkin = '';
		} else if (settings.bootswatchSkin !== '' && await meta.css.isSkinValid(settings.bootswatchSkin)) {
			config.bootswatchSkin = settings.bootswatchSkin;
		}
	}

	// Overrides based on privilege
	config.disableChatMessageEditing = isAdminOrGlobalMod ? false : config.disableChatMessageEditing;

	return await plugins.hooks.fire('filter:config.get', config);
};

apiController.getConfig = async function (req, res) {
	const config = await apiController.loadConfig(req);
	res.json(config);
};

apiController.getModerators = async function (req, res) {
	const moderators = await categories.getModerators(req.params.cid);
	res.json({ moderators: moderators });
};

require('../promisify')(apiController, ['getConfig', 'getObject', 'getModerators']);
