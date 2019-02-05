'use strict';

var async = require('async');
var nconf = require('nconf');
var jsesc = require('jsesc');
var _ = require('lodash');

var db = require('../database');
var user = require('../user');
var topics = require('../topics');
var messaging = require('../messaging');
var meta = require('../meta');
var plugins = require('../plugins');
var navigation = require('../navigation');
var translator = require('../translator');
var privileges = require('../privileges');
var languages = require('../languages');
var utils = require('../utils');

var controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers'),
};

module.exports = function (middleware) {
	middleware.buildHeader = function buildHeader(req, res, next) {
		res.locals.renderHeader = true;
		res.locals.isAPI = false;
		async.waterfall([
			function (next) {
				if (req.uid >= 0) {
					middleware.applyCSRF(req, res, next);
				} else {
					setImmediate(next);
				}
			},
			function (next) {
				async.parallel({
					config: function (next) {
						controllers.api.getConfig(req, res, next);
					},
					plugins: function (next) {
						plugins.fireHook('filter:middleware.buildHeader', { req: req, locals: res.locals }, next);
					},
				}, next);
			},
			function (results, next) {
				// Return no arguments
				setImmediate(next);
			},
		], next);
	};

	middleware.generateHeader = function generateHeader(req, res, data, callback) {
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
			allowRegistration: registrationType === 'normal' || registrationType === 'admin-approval' || registrationType === 'admin-approval-ip',
			searchEnabled: plugins.hasListeners('filter:search.query'),
			config: res.locals.config,
			relative_path: nconf.get('relative_path'),
			bodyClass: data.bodyClass,
		};

		templateValues.configJSON = jsesc(JSON.stringify(res.locals.config), { isScriptContext: true });

		async.waterfall([
			function (next) {
				async.parallel({
					isAdmin: function (next) {
						user.isAdministrator(req.uid, next);
					},
					isGlobalMod: function (next) {
						user.isGlobalModerator(req.uid, next);
					},
					isModerator: function (next) {
						user.isModeratorOfAnyCategory(req.uid, next);
					},
					privileges: function (next) {
						privileges.global.get(req.uid, next);
					},
					user: function (next) {
						user.getUserData(req.uid, next);
					},
					isEmailConfirmSent: function (next) {
						if (!meta.config.requireEmailConfirmation || req.uid <= 0) {
							return next(null, false);
						}
						db.get('uid:' + req.uid + ':confirm:email:sent', next);
					},
					languageDirection: function (next) {
						translator.translate('[[language:dir]]', res.locals.config.userLang, function (translated) {
							next(null, translated);
						});
					},
					browserTitle: function (next) {
						translator.translate(controllers.helpers.buildTitle(translator.unescape(data.title)), function (translated) {
							next(null, translated);
						});
					},
					navigation: async.apply(navigation.get, req.uid),
					tags: async.apply(meta.tags.parse, req, data, res.locals.metaTags, res.locals.linkTags),
					banned: async.apply(user.isBanned, req.uid),
					banReason: async.apply(user.getBannedReason, req.uid),

					unreadData: async.apply(topics.getUnreadData, { uid: req.uid }),
					unreadChatCount: async.apply(messaging.getUnreadCount, req.uid),
					unreadNotificationCount: async.apply(user.notifications.getUnreadCount, req.uid),
				}, next);
			},
			function (results, next) {
				if (results.banned) {
					req.logout();
					return res.redirect('/');
				}

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
				results.user[results.user.status] = true;

				results.user.email = String(results.user.email);
				results.user['email:confirmed'] = results.user['email:confirmed'] === 1;
				results.user.isEmailConfirmSent = !!results.isEmailConfirmSent;

				templateValues.bootswatchSkin = (parseInt(meta.config.disableCustomUserSkins, 10) !== 1 ? res.locals.config.bootswatchSkin : '') || meta.config.bootswatchSkin || '';
				templateValues.config.bootswatchSkin = templateValues.bootswatchSkin || 'noskin';	// TODO remove in v1.12.0+

				const unreadCounts = results.unreadData.counts;
				var unreadCount = {
					topic: unreadCounts[''] || 0,
					newTopic: unreadCounts.new || 0,
					watchedTopic: unreadCounts.watched || 0,
					unrepliedTopic: unreadCounts.unreplied || 0,
					chat: results.unreadChatCount || 0,
					notification: results.unreadNotificationCount || 0,
				};

				Object.keys(unreadCount).forEach(function (key) {
					if (unreadCount[key] > 99) {
						unreadCount[key] = '99+';
					}
				});

				const tidsByFilter = results.unreadData.tidsByFilter;
				results.navigation = results.navigation.map(function (item) {
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
					return item;
				});

				templateValues.browserTitle = results.browserTitle;
				templateValues.navigation = results.navigation;
				templateValues.unreadCount = unreadCount;
				templateValues.metaTags = results.tags.meta;
				templateValues.linkTags = results.tags.link;
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

				templateValues.template = { name: res.locals.template };
				templateValues.template[res.locals.template] = true;

				if (req.route && req.route.path === '/') {
					modifyTitle(templateValues);
				}

				plugins.fireHook('filter:middleware.renderHeader', {
					req: req,
					res: res,
					templateValues: templateValues,
				}, next);
			},
		], function (err, data) {
			callback(err, data.templateValues);
		});
	};

	middleware.renderHeader = function renderHeader(req, res, data, callback) {
		async.waterfall([
			async.apply(middleware.generateHeader, req, res, data),
			function (templateValues, next) {
				req.app.render('header', templateValues, next);
			},
		], callback);
	};

	middleware.renderFooter = function renderFooter(req, res, data, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:middleware.renderFooter', {
					req: req,
					res: res,
					templateValues: data,
				}, next);
			},
			function (data, next) {
				async.parallel({
					scripts: async.apply(plugins.fireHook, 'filter:scripts.get', []),
					timeagoLocale: (next) => {
						async.waterfall([
							async.apply(languages.listCodes),
							(languageCodes, next) => {
								const userLang = res.locals.config.userLang;
								const timeagoCode = utils.userLangToTimeagoCode(userLang);

								if (languageCodes.includes(userLang) && languages.timeagoCodes.includes(timeagoCode)) {
									const pathToLocaleFile = '/vendor/jquery/timeago/locales/jquery.timeago.' + timeagoCode + '.js';
									next(null, (nconf.get('relative_path') + '/assets' + pathToLocaleFile));
								} else {
									next(null, false);
								}
							},
						], next);
					},
				}, function (err, results) {
					next(err, data, results);
				});
			},
			function (data, results, next) {
				if (results.timeagoLocale) {
					results.scripts.push(results.timeagoLocale);
				}
				data.templateValues.scripts = results.scripts.map(function (script) {
					return { src: script };
				});

				data.templateValues.useCustomJS = meta.config.useCustomJS;
				data.templateValues.customJS = data.templateValues.useCustomJS ? meta.config.customJS : '';
				data.templateValues.isSpider = req.uid === -1;
				req.app.render('footer', data.templateValues, next);
			},
		], callback);
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
};
