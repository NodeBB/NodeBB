'use strict';

const validator = require('validator');
import nconf from 'nconf';

import meta from '../meta';
import user from '../user';
const categories = require('../categories');
import plugins from '../plugins';
const translator = require('../translator');
const languages = require('../languages');

const apiController  = {} as any;

const relative_path = nconf.get('relative_path');
const upload_url = nconf.get('upload_url');
const asset_base_url = nconf.get('asset_base_url');
const socketioTransports = nconf.get('socket.io:transports') || ['polling', 'websocket'];
const socketioOrigins = nconf.get('socket.io:origins');
const websocketAddress = nconf.get('socket.io:address') || '';

apiController.loadConfig = async function (req) {
	const config = {
		relative_path,
		upload_url,
		asset_base_url,
		assetBaseUrl: asset_base_url, // deprecate in 1.20.x
		siteTitle: validator.escape(String(meta.configs.title || meta.configs.browserTitle || 'NodeBB')),
		browserTitle: validator.escape(String(meta.configs.browserTitle || meta.configs.title || 'NodeBB')),
		titleLayout: (meta.configs.titleLayout || '{pageTitle} | {browserTitle}').replace(/{/g, '&#123;').replace(/}/g, '&#125;'),
		showSiteTitle: meta.configs.showSiteTitle === 1,
		maintenanceMode: meta.configs.maintenanceMode === 1,
		minimumTitleLength: meta.configs.minimumTitleLength,
		maximumTitleLength: meta.configs.maximumTitleLength,
		minimumPostLength: meta.configs.minimumPostLength,
		maximumPostLength: meta.configs.maximumPostLength,
		minimumTagsPerTopic: meta.configs.minimumTagsPerTopic || 0,
		maximumTagsPerTopic: meta.configs.maximumTagsPerTopic || 5,
		minimumTagLength: meta.configs.minimumTagLength || 3,
		maximumTagLength: meta.configs.maximumTagLength || 15,
		undoTimeout: meta.configs.undoTimeout || 0,
		useOutgoingLinksPage: meta.configs.useOutgoingLinksPage === 1,
		outgoingLinksWhitelist: meta.configs.useOutgoingLinksPage === 1 ? meta.config['outgoingLinks:whitelist'] : undefined,
		allowGuestHandles: meta.configs.allowGuestHandles === 1,
		allowTopicsThumbnail: meta.configs.allowTopicsThumbnail === 1,
		usePagination: meta.configs.usePagination === 1,
		disableChat: meta.configs.disableChat === 1,
		disableChatMessageEditing: meta.configs.disableChatMessageEditing === 1,
		maximumChatMessageLength: meta.configs.maximumChatMessageLength || 1000,
		socketioTransports,
		socketioOrigins,
		websocketAddress,
		maxReconnectionAttempts: meta.configs.maxReconnectionAttempts,
		reconnectionDelay: meta.configs.reconnectionDelay,
		topicsPerPage: meta.configs.topicsPerPage || 20,
		postsPerPage: meta.configs.postsPerPage || 20,
		maximumFileSize: meta.configs.maximumFileSize,
		'theme:id': meta.config['theme:id'],
		'theme:src': meta.config['theme:src'],
		defaultLang: meta.configs.defaultLang || 'en-GB',
		userLang: req.query.lang ? validator.escape(String(req.query.lang)) : (meta.configs.defaultLang || 'en-GB'),
		loggedIn: !!req.user,
		uid: req.uid,
		'cache-buster': meta.config['cache-buster'] || '',
		topicPostSort: meta.configs.topicPostSort || 'oldest_to_newest',
		categoryTopicSort: meta.configs.categoryTopicSort || 'newest_to_oldest',
		csrf_token: req.uid >= 0 && req.csrfToken && req.csrfToken(),
		searchEnabled: plugins.hooks.hasListeners('filter:search.query'),
		searchDefaultInQuick: meta.configs.searchDefaultInQuick || 'titles',
		bootswatchSkin: meta.configs.bootswatchSkin || '',
		enablePostHistory: meta.configs.enablePostHistory === 1,
		timeagoCutoff: meta.configs.timeagoCutoff !== '' ? Math.max(0, parseInt(meta.configs.timeagoCutoff, 10)) : meta.configs.timeagoCutoff,
		timeagoCodes: languages.timeagoCodes,
		cookies: {
			enabled: meta.configs.cookieConsentEnabled === 1,
			message: translator.escape(validator.escape(meta.configs.cookieConsentMessage || '[[global:cookies.message]]')).replace(/\\/g, '\\\\'),
			dismiss: translator.escape(validator.escape(meta.configs.cookieConsentDismiss || '[[global:cookies.accept]]')).replace(/\\/g, '\\\\'),
			link: translator.escape(validator.escape(meta.configs.cookieConsentLink || '[[global:cookies.learn_more]]')).replace(/\\/g, '\\\\'),
			link_url: translator.escape(validator.escape(meta.configs.cookieConsentLinkUrl || 'https://www.cookiesandyou.com')).replace(/\\/g, '\\\\'),
		},
		thumbs: {
			size: meta.configs.topicThumbSize,
		},
		iconBackgrounds: await user.getIconBackgrounds(req.uid),
		emailPrompt: meta.configs.emailPrompt,
		useragent: req.useragent,
	} as any;

	let settings = config;
	let isAdminOrGlobalMod;
	if (req.loggedIn) {
		([settings, isAdminOrGlobalMod] = await Promise.all([
			user.getSettings(req.uid),
			user.isAdminOrGlobalMod(req.uid),
		]));
	}

	// Handle old skin configs
	const oldSkins = ['noskin', 'default'];
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
	config.bootswatchSkin = (meta.configs.disableCustomUserSkins !== 1 && settings.bootswatchSkin && settings.bootswatchSkin !== '') ? settings.bootswatchSkin : '';

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

require('../promisify').promisify(apiController, ['getConfig', 'getObject', 'getModerators']);
