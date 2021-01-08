'use strict';

var nconf = require('nconf');
var jsesc = require('jsesc');
var _ = require('lodash');
const validator = require('validator');
var util = require('util');

var db = require('../database');
var user = require('../user');
var topics = require('../topics');
var messaging = require('../messaging');
var flags = require('../flags');
var meta = require('../meta');
var plugins = require('../plugins');
var navigation = require('../navigation');
var translator = require('../translator');
var privileges = require('../privileges');
var languages = require('../languages');
var utils = require('../utils');
var helpers = require('./helpers');

var controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers'),
};

const middleware = module.exports;

const relative_path = nconf.get('relative_path');

middleware.buildHeader = helpers.try(async function buildHeader(req, res, next) {
	res.locals.renderHeader = true;
	res.locals.isAPI = false;
	const [config, isBanned] = await Promise.all([
		controllers.api.loadConfig(req),
		user.bans.isBanned(req.uid),
		plugins.hooks.fire('filter:middleware.buildHeader', { req: req, locals: res.locals }),
	]);

	if (isBanned) {
		req.logout();
		return res.redirect('/');
	}
	res.locals.config = config;
	next();
});

middleware.buildHeaderAsync = util.promisify(middleware.buildHeader);

middleware.renderHeader = async function renderHeader(req, res, data) {
	var registrationType = meta.config.registrationType || 'normal';
	res.locals.config = res.locals.config || {};
	var templateValues = {
		title: meta.config.title || '',
		'title:url': meta.config['title:url'] || '',
		description: meta.config.description || '',
		'cache-buster': meta.config['cache-buster'] || '',
		'brand:logo': meta.config['brand:logo'] || '',
		'brand:logo:url': meta.config['brand:logo:url'] || '',
		'brand:logo:alt': meta.config['brand:logo:alt'] || '',
		'brand:logo:display': meta.config['brand:logo'] ? '' : 'hide',
		allowRegistration: registrationType === 'normal',
		searchEnabled: plugins.hooks.hasListeners('filter:search.query'),
		config: res.locals.config,
		relative_path,
		bodyClass: data.bodyClass,
	};

	templateValues.configJSON = jsesc(JSON.stringify(res.locals.config), { isScriptContext: true });

	const results = await utils.promiseParallel({
		isAdmin: user.isAdministrator(req.uid),
		isGlobalMod: user.isGlobalModerator(req.uid),
		isModerator: user.isModeratorOfAnyCategory(req.uid),
		privileges: privileges.global.get(req.uid),
		user: user.getUserData(req.uid),
		isEmailConfirmSent: (!meta.config.requireEmailConfirmation || req.uid <= 0) ? false : await db.get('uid:' + req.uid + ':confirm:email:sent'),
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

	templateValues.bootswatchSkin = (parseInt(meta.config.disableCustomUserSkins, 10) !== 1 ? res.locals.config.bootswatchSkin : '') || meta.config.bootswatchSkin || '';
	templateValues.config.bootswatchSkin = templateValues.bootswatchSkin || 'noskin';	// TODO remove in v1.12.0+
	templateValues.browserTitle = results.browserTitle;
	({
		navigation: templateValues.navigation,
		unreadCount: templateValues.unreadCount,
	} = await appendUnreadCounts({
		uid: req.uid,
		navigation: results.navigation,
		unreadData,
	}));
	templateValues.isAdmin = results.user.isAdmin;
	templateValues.isGlobalMod = results.user.isGlobalMod;
	templateValues.showModMenu = results.user.isAdmin || results.user.isGlobalMod || results.user.isMod;
	templateValues.canChat = results.canChat && meta.config.disableChat !== 1;
	templateValues.user = results.user;
	templateValues.userJSON = jsesc(JSON.stringify(results.user), { isScriptContext: true });
	templateValues.useCustomCSS = meta.config.useCustomCSS && meta.config.customCSS;
	templateValues.customCSS = templateValues.useCustomCSS ? (meta.config.renderedCustomCSS || '') : '';
	templateValues.useCustomHTML = meta.config.useCustomHTML;
	templateValues.customHTML = templateValues.useCustomHTML ? meta.config.customHTML : '';
	templateValues.maintenanceHeader = meta.config.maintenanceMode && !results.isAdmin;
	templateValues.defaultLang = meta.config.defaultLang || 'en-GB';
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

	const hookReturn = await plugins.hooks.fire('filter:middleware.renderHeader', {
		req: req,
		res: res,
		templateValues: templateValues,
		data: data,
	});

	return await req.app.renderAsync('header', hookReturn.templateValues);
};

async function appendUnreadCounts({ uid, navigation, unreadData }) {
	const originalRoutes = navigation.map(nav => nav.originalRoute);
	const calls = {
		unreadData: topics.getUnreadData({ uid: uid }),
		unreadChatCount: messaging.getUnreadCount(uid),
		unreadNotificationCount: user.notifications.getUnreadCount(uid),
		unreadFlagCount: (async function () {
			if (originalRoutes.includes('/flags') && await user.isPrivileged(uid)) {
				return flags.getCount({
					uid,
					filters: {
						quick: 'unresolved',
						cid: (await user.isAdminOrGlobalMod(uid)) ? [] : (await user.getModeratedCids(uid)),
					},
				});
			}
			return 0;
		}()),
	};
	const results = await utils.promiseParallel(calls);

	const unreadCounts = results.unreadData.counts;
	const unreadCount = {
		topic: unreadCounts[''] || 0,
		newTopic: unreadCounts.new || 0,
		watchedTopic: unreadCounts.watched || 0,
		unrepliedTopic: unreadCounts.unreplied || 0,
		chat: results.unreadChatCount || 0,
		notification: results.unreadNotificationCount || 0,
		flags: results.unreadFlagCount || 0,
	};

	Object.keys(unreadCount).forEach(function (key) {
		if (unreadCount[key] > 99) {
			unreadCount[key] = '99+';
		}
	});

	const tidsByFilter = results.unreadData.tidsByFilter;
	navigation = navigation.map(function (item) {
		function modifyNavItem(item, route, filter, content) {
			if (item && item.originalRoute === route) {
				unreadData[filter] = _.zipObject(tidsByFilter[filter], tidsByFilter[filter].map(() => true));
				item.content = content;
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
}

middleware.renderFooter = async function renderFooter(req, res, templateValues) {
	const data = await plugins.hooks.fire('filter:middleware.renderFooter', {
		req: req,
		res: res,
		templateValues: templateValues,
	});

	const scripts = await plugins.hooks.fire('filter:scripts.get', []);

	data.templateValues.scripts = scripts.map(function (script) {
		return { src: script };
	});

	data.templateValues.useCustomJS = meta.config.useCustomJS;
	data.templateValues.customJS = data.templateValues.useCustomJS ? meta.config.customJS : '';
	data.templateValues.isSpider = req.uid === -1;

	return await req.app.renderAsync('footer', data.templateValues);
};

function modifyTitle(obj) {
	var title = controllers.helpers.buildTitle(meta.config.homePageTitle || '[[pages:home]]');
	obj.browserTitle = title;

	if (obj.metaTags) {
		obj.metaTags.forEach(function (tag, i) {
			if (tag.property === 'og:title') {
				obj.metaTags[i].content = title;
			}
		});
	}

	return title;
}
