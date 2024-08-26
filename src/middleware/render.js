'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const validator = require('validator');
const jsesc = require('jsesc');
const winston = require('winston');
const semver = require('semver');

const db = require('../database');
const navigation = require('../navigation');
const translator = require('../translator');
const privileges = require('../privileges');
const languages = require('../languages');
const plugins = require('../plugins');
const user = require('../user');
const topics = require('../topics');
const messaging = require('../messaging');
const flags = require('../flags');
const meta = require('../meta');
const widgets = require('../widgets');
const utils = require('../utils');
const helpers = require('./helpers');
const versions = require('../admin/versions');
const controllersHelpers = require('../controllers/helpers');

const relative_path = nconf.get('relative_path');

module.exports = function (middleware) {
	middleware.processRender = function processRender(req, res, next) {
		// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
		const { render } = res;

		res.render = async function renderOverride(template, options, fn) {
			const self = this;
			const { req } = this;
			async function renderMethod(template, options, fn) {
				options = options || {};
				if (typeof options === 'function') {
					fn = options;
					options = {};
				}

				options.loggedIn = req.uid > 0;
				options.loggedInUser = await getLoggedInUser(req);
				options.relative_path = relative_path;
				options.template = { name: template, [template]: true };
				options.url = (req.baseUrl + req.path.replace(/^\/api/, ''));
				options.bodyClass = helpers.buildBodyClass(req, res, options);

				if (req.loggedIn) {
					res.set('cache-control', 'private');
				}

				const buildResult = await plugins.hooks.fire(`filter:${template}.build`, {
					req: req,
					res: res,
					templateData: options,
				});
				if (res.headersSent) {
					return;
				}
				const templateToRender = buildResult.templateData.templateToRender || template;

				const renderResult = await plugins.hooks.fire('filter:middleware.render', {
					req: req,
					res: res,
					templateData: buildResult.templateData,
				});
				if (res.headersSent) {
					return;
				}
				options = renderResult.templateData;
				options._header = {
					tags: await meta.tags.parse(req, renderResult, res.locals.metaTags, res.locals.linkTags),
				};
				options.widgets = await widgets.render(req.uid, {
					template: `${template}.tpl`,
					url: options.url,
					templateData: options,
					req: req,
					res: res,
				});
				res.locals.template = template;
				options._locals = undefined;

				if (res.locals.isAPI) {
					if (req.route && req.route.path === '/api/') {
						options.title = '[[pages:home]]';
					}
					req.app.set('json spaces', global.env === 'development' || req.query.pretty ? 4 : 0);
					return res.json(options);
				}
				const optionsString = JSON.stringify(options).replace(/<\//g, '<\\/');
				const headerFooterData = await loadHeaderFooterData(req, res, options);
				const results = await utils.promiseParallel({
					header: renderHeaderFooter('renderHeader', req, res, options, headerFooterData),
					content: renderContent(render, templateToRender, req, res, options),
					footer: renderHeaderFooter('renderFooter', req, res, options, headerFooterData),
				});

				const str = `${results.header +
					(res.locals.postHeader || '') +
					results.content
				}<script id="ajaxify-data" type="application/json">${
					optionsString
				}</script>${
					res.locals.preFooter || ''
				}${results.footer}`;

				if (typeof fn !== 'function') {
					self.send(str);
				} else {
					fn(null, str);
				}
			}

			try {
				await renderMethod(template, options, fn);
			} catch (err) {
				next(err);
			}
		};

		next();
	};

	async function getLoggedInUser(req) {
		if (req.user) {
			return await user.getUserData(req.uid);
		}
		return {
			uid: req.uid === -1 ? -1 : 0,
			username: '[[global:guest]]',
			picture: user.getDefaultAvatar(),
			'icon:text': '?',
			'icon:bgColor': '#aaa',
		};
	}

	async function loadHeaderFooterData(req, res, options) {
		if (res.locals.renderHeader) {
			return await loadClientHeaderFooterData(req, res, options);
		} else if (res.locals.renderAdminHeader) {
			return await loadAdminHeaderFooterData(req, res, options);
		}
		return null;
	}

	async function loadClientHeaderFooterData(req, res, options) {
		const registrationType = meta.config.registrationType || 'normal';
		res.locals.config = res.locals.config || {};
		const templateValues = {
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
			postQueueEnabled: !!meta.config.postQueue,
			registrationQueueEnabled: meta.config.registrationApprovalType !== 'normal' || (meta.config.registrationType === 'invite-only' || meta.config.registrationType === 'admin-invite-only'),
			config: res.locals.config,
			relative_path,
			bodyClass: options.bodyClass,
			widgets: options.widgets,
		};

		templateValues.configJSON = jsesc(JSON.stringify(res.locals.config), { isScriptContext: true });

		const title = translator.unescape(utils.stripHTMLTags(options.title || ''));
		const results = await utils.promiseParallel({
			isAdmin: user.isAdministrator(req.uid),
			isGlobalMod: user.isGlobalModerator(req.uid),
			isModerator: user.isModeratorOfAnyCategory(req.uid),
			privileges: privileges.global.get(req.uid),
			blocks: user.blocks.list(req.uid),
			user: user.getUserData(req.uid),
			isEmailConfirmSent: req.uid <= 0 ? false : await user.email.isValidationPending(req.uid),
			languageDirection: translator.translate('[[language:dir]]', res.locals.config.userLang),
			timeagoCode: languages.userTimeagoCode(res.locals.config.userLang),
			browserTitle: translator.translate(controllersHelpers.buildTitle(title)),
			navigation: navigation.get(req.uid),
			roomIds: req.uid > 0 ? db.getSortedSetRevRange(`uid:${req.uid}:chat:rooms`, 0, 0) : [],
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
		results.user.blocks = results.blocks;
		results.user.timeagoCode = results.timeagoCode;
		results.user[results.user.status] = true;
		results.user.lastRoomId = results.roomIds.length ? results.roomIds[0] : null;

		results.user.email = String(results.user.email);
		results.user['email:confirmed'] = results.user['email:confirmed'] === 1;
		results.user.isEmailConfirmSent = !!results.isEmailConfirmSent;

		templateValues.bootswatchSkin = res.locals.config.bootswatchSkin || '';
		templateValues.browserTitle = results.browserTitle;
		({
			navigation: templateValues.navigation,
			unreadCount: templateValues.unreadCount,
		} = await appendUnreadCounts({
			uid: req.uid,
			query: req.query,
			navigation: results.navigation,
			unreadData,
		}));
		templateValues.isAdmin = results.user.isAdmin;
		templateValues.isGlobalMod = results.user.isGlobalMod;
		templateValues.showModMenu = results.user.isAdmin || results.user.isGlobalMod || results.user.isMod;
		templateValues.canChat = (results.privileges.chat || results.privileges['chat:privileged']) && meta.config.disableChat !== 1;
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

		if (options.hasOwnProperty('_header')) {
			templateValues.metaTags = options._header.tags.meta;
			templateValues.linkTags = options._header.tags.link;
		}

		if (req.route && req.route.path === '/') {
			modifyTitle(templateValues);
		}
		return templateValues;
	}

	async function loadAdminHeaderFooterData(req, res, options) {
		const custom_header = {
			plugins: [],
			authentication: [],
		};
		res.locals.config = res.locals.config || {};

		const results = await utils.promiseParallel({
			userData: user.getUserFields(req.uid, ['username', 'userslug', 'email', 'picture', 'email:confirmed']),
			scripts: getAdminScripts(),
			custom_header: plugins.hooks.fire('filter:admin.header.build', custom_header),
			configs: meta.configs.list(),
			latestVersion: getLatestVersion(),
			privileges: privileges.admin.get(req.uid),
			tags: meta.tags.parse(req, {}, [], []),
			languageDirection: translator.translate('[[language:dir]]', res.locals.config.acpLang),
		});

		const { userData } = results;
		userData.uid = req.uid;
		userData['email:confirmed'] = userData['email:confirmed'] === 1;
		userData.privileges = results.privileges;

		let acpPath = req.path.slice(1).split('/');
		acpPath.forEach((path, i) => {
			acpPath[i] = path.charAt(0).toUpperCase() + path.slice(1);
		});
		acpPath = acpPath.join(' > ');

		const version = nconf.get('version');

		res.locals.config.userLang = res.locals.config.acpLang || res.locals.config.userLang;
		res.locals.config.isRTL = results.languageDirection === 'rtl';
		const templateValues = {
			config: res.locals.config,
			configJSON: jsesc(JSON.stringify(res.locals.config), { isScriptContext: true }),
			relative_path: res.locals.config.relative_path,
			adminConfigJSON: encodeURIComponent(JSON.stringify(results.configs)),
			metaTags: results.tags.meta,
			linkTags: results.tags.link,
			user: userData,
			userJSON: jsesc(JSON.stringify(userData), { isScriptContext: true }),
			plugins: results.custom_header.plugins,
			authentication: results.custom_header.authentication,
			scripts: results.scripts,
			'cache-buster': meta.config['cache-buster'] || '',
			env: !!process.env.NODE_ENV,
			title: `${acpPath || 'Dashboard'} | NodeBB Admin Control Panel`,
			bodyClass: options.bodyClass,
			version: version,
			latestVersion: results.latestVersion,
			upgradeAvailable: results.latestVersion && semver.gt(results.latestVersion, version),
			showManageMenu: results.privileges.superadmin || ['categories', 'privileges', 'users', 'admins-mods', 'groups', 'tags', 'settings'].some(priv => results.privileges[`admin:${priv}`]),
			defaultLang: meta.config.defaultLang || 'en-GB',
			acpLang: res.locals.config.acpLang,
			languageDirection: results.languageDirection,
		};

		templateValues.template = { name: res.locals.template };
		templateValues.template[res.locals.template] = true;
		return templateValues;
	}

	function renderContent(render, tpl, req, res, options) {
		return new Promise((resolve, reject) => {
			render.call(res, tpl, options, async (err, str) => {
				if (err) reject(err);
				else resolve(await translate(str, getLang(req, res)));
			});
		});
	}

	async function renderHeader(req, res, options, headerFooterData) {
		const hookReturn = await plugins.hooks.fire('filter:middleware.renderHeader', {
			req: req,
			res: res,
			templateValues: headerFooterData, // TODO: deprecate
			templateData: headerFooterData,
			data: options,
		});

		return await req.app.renderAsync('header', hookReturn.templateData);
	}

	async function renderFooter(req, res, options, headerFooterData) {
		const hookReturn = await plugins.hooks.fire('filter:middleware.renderFooter', {
			req,
			res,
			templateValues: headerFooterData, // TODO: deprecate
			templateData: headerFooterData,
			data: options,
		});

		const scripts = await plugins.hooks.fire('filter:scripts.get', []);

		hookReturn.templateData.scripts = scripts.map(script => ({ src: script }));

		hookReturn.templateData.useCustomJS = meta.config.useCustomJS;
		hookReturn.templateData.customJS = hookReturn.templateData.useCustomJS ? meta.config.customJS : '';
		hookReturn.templateData.isSpider = req.uid === -1;

		return await req.app.renderAsync('footer', hookReturn.templateData);
	}

	async function renderAdminHeader(req, res, options, headerFooterData) {
		const hookReturn = await plugins.hooks.fire('filter:middleware.renderAdminHeader', {
			req,
			res,
			templateValues: headerFooterData, // TODO: deprecate
			templateData: headerFooterData,
			data: options,
		});

		return await req.app.renderAsync('admin/header', hookReturn.templateData);
	}

	async function renderAdminFooter(req, res, options, headerFooterData) {
		const hookReturn = await plugins.hooks.fire('filter:middleware.renderAdminFooter', {
			req,
			res,
			templateValues: headerFooterData, // TODO: deprecate
			templateData: headerFooterData,
			data: options,
		});

		return await req.app.renderAsync('admin/footer', hookReturn.templateData);
	}

	async function renderHeaderFooter(method, req, res, options, headerFooterData) {
		let str = '';
		if (res.locals.renderHeader) {
			if (method === 'renderHeader') {
				str = await renderHeader(req, res, options, headerFooterData);
			} else if (method === 'renderFooter') {
				str = await renderFooter(req, res, options, headerFooterData);
			}
		} else if (res.locals.renderAdminHeader) {
			if (method === 'renderHeader') {
				str = await renderAdminHeader(req, res, options, headerFooterData);
			} else if (method === 'renderFooter') {
				str = await renderAdminFooter(req, res, options, headerFooterData);
			}
		}
		return await translate(str, getLang(req, res));
	}

	function getLang(req, res) {
		let language = (res.locals.config && res.locals.config.userLang) || 'en-GB';
		if (res.locals.renderAdminHeader) {
			language = (res.locals.config && res.locals.config.acpLang) || 'en-GB';
		}
		return req.query.lang ? validator.escape(String(req.query.lang)) : language;
	}

	async function translate(str, language) {
		const translated = await translator.translate(str, language);
		return translator.unescape(translated);
	}

	async function appendUnreadCounts({ uid, navigation, unreadData, query }) {
		const originalRoutes = navigation.map(nav => nav.originalRoute);
		const calls = {
			unreadData: topics.getUnreadData({ uid: uid, query: query }),
			unreadChatCount: messaging.getUnreadCount(uid),
			unreadNotificationCount: user.notifications.getUnreadCount(uid),
			unreadFlagCount: (async function () {
				if (originalRoutes.includes('/flags') && await user.isPrivileged(uid)) {
					return flags.getCount({
						uid,
						query,
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
	}


	function modifyTitle(obj) {
		const title = controllersHelpers.buildTitle(meta.config.homePageTitle || '[[pages:home]]');
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

	async function getAdminScripts() {
		const scripts = await plugins.hooks.fire('filter:admin.scripts.get', []);
		return scripts.map(script => ({ src: script }));
	}

	async function getLatestVersion() {
		try {
			return await versions.getLatestVersion();
		} catch (err) {
			winston.error(`[acp] Failed to fetch latest version${err.stack}`);
		}
		return null;
	}
};
