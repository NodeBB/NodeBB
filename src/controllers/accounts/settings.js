'use strict';

var async = require('async');
var nconf = require('nconf');
var winston = require('winston');
var _ = require('lodash');
var jwt = require('jsonwebtoken');

var user = require('../../user');
var languages = require('../../languages');
var meta = require('../../meta');
var plugins = require('../../plugins');
var privileges = require('../../privileges');
var categories = require('../../categories');
var notifications = require('../../notifications');
var db = require('../../database');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var settingsController = module.exports;

settingsController.get = function (req, res, callback) {
	var userData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}
			async.parallel({
				settings: function (next) {
					user.getSettings(userData.uid, next);
				},
				languages: function (next) {
					languages.list(next);
				},
				soundsMapping: function (next) {
					meta.sounds.getUserSoundMap(userData.uid, next);
				},
			}, next);
		},
		function (results, next) {
			userData.settings = results.settings;
			userData.languages = results.languages;
			if (userData.isAdmin && userData.isSelf) {
				userData.acpLanguages = _.cloneDeep(results.languages);
			}

			var types = [
				'notification',
				'chat-incoming',
				'chat-outgoing',
			];
			var aliases = {
				notification: 'notificationSound',
				'chat-incoming': 'incomingChatSound',
				'chat-outgoing': 'outgoingChatSound',
			};

			types.forEach(function (type) {
				var soundpacks = plugins.soundpacks.map(function (pack) {
					var sounds = Object.keys(pack.sounds).map(function (soundName) {
						var value = pack.name + ' | ' + soundName;
						return {
							name: soundName,
							value: value,
							selected: value === results.soundsMapping[type],
						};
					});

					return {
						name: pack.name,
						sounds: sounds,
					};
				});

				userData[type + '-sound'] = soundpacks;
				// fallback
				userData[aliases[type]] = soundpacks.concat.apply([], soundpacks.map(function (pack) {
					return pack.sounds.map(function (sound) {
						return {
							name: sound.value,
							selected: sound.selected,
						};
					});
				}));
			});

			plugins.fireHook('filter:user.customSettings', { settings: results.settings, customSettings: [], uid: req.uid }, next);
		},
		function (data, next) {
			userData.customSettings = data.customSettings;
			async.parallel({
				notificationSettings: function (next) {
					getNotificationSettings(userData, next);
				},
				routes: function (next) {
					getHomePageRoutes(userData, next);
				},
			}, next);
		},
		function (results) {
			userData.homePageRoutes = results.routes;
			userData.notificationSettings = results.notificationSettings;
			userData.disableEmailSubscriptions = meta.config.disableEmailSubscriptions;

			userData.dailyDigestFreqOptions = [
				{ value: 'off', name: '[[user:digest_off]]', selected: userData.settings.dailyDigestFreq === 'off' },
				{ value: 'day', name: '[[user:digest_daily]]', selected: userData.settings.dailyDigestFreq === 'day' },
				{ value: 'week', name: '[[user:digest_weekly]]', selected: userData.settings.dailyDigestFreq === 'week' },
				{ value: 'month', name: '[[user:digest_monthly]]', selected: userData.settings.dailyDigestFreq === 'month' },
			];

			userData.bootswatchSkinOptions = [
				{ name: 'Default', value: '' },
				{ name: 'Cerulean', value: 'cerulean' },
				{ name: 'Cosmo', value: 'cosmo'	},
				{ name: 'Cyborg', value: 'cyborg' },
				{ name: 'Darkly', value: 'darkly' },
				{ name: 'Flatly', value: 'flatly' },
				{ name: 'Journal', value: 'journal'	},
				{ name: 'Lumen', value: 'lumen' },
				{ name: 'Paper', value: 'paper' },
				{ name: 'Readable', value: 'readable' },
				{ name: 'Sandstone', value: 'sandstone' },
				{ name: 'Simplex', value: 'simplex' },
				{ name: 'Slate', value: 'slate'	},
				{ name: 'Spacelab', value: 'spacelab' },
				{ name: 'Superhero', value: 'superhero' },
				{ name: 'United', value: 'united' },
				{ name: 'Yeti', value: 'yeti' },
			];

			userData.bootswatchSkinOptions.forEach(function (skin) {
				skin.selected = skin.value === userData.settings.bootswatchSkin;
			});

			userData.languages.forEach(function (language) {
				language.selected = language.code === userData.settings.userLang;
			});

			if (userData.isAdmin && userData.isSelf) {
				userData.acpLanguages.forEach(function (language) {
					language.selected = language.code === userData.settings.acpLang;
				});
			}

			var notifFreqOptions = [
				'all',
				'first',
				'everyTen',
				'threshold',
				'logarithmic',
				'disabled',
			];

			userData.upvoteNotifFreq = notifFreqOptions.map(function (name) {
				return {
					name: name,
					selected: name === userData.settings.upvoteNotifFreq,
				};
			});

			userData.categoryWatchState = { [userData.settings.categoryWatchState]: true };

			userData.disableCustomUserSkins = meta.config.disableCustomUserSkins;

			userData.allowUserHomePage = meta.config.allowUserHomePage;

			userData.hideFullname = meta.config.hideFullname;
			userData.hideEmail = meta.config.hideEmail;

			userData.inTopicSearchAvailable = plugins.hasListeners('filter:topic.search');

			userData.maxTopicsPerPage = meta.config.maxTopicsPerPage;
			userData.maxPostsPerPage = meta.config.maxPostsPerPage;

			userData.title = '[[pages:account/settings]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:settings]]' }]);

			res.render('account/settings', userData);
		},
	], callback);
};

settingsController.unsubscribe = function (req, res) {
	if (!req.params.token) {
		return res.sendStatus(404);
	}

	jwt.verify(req.params.token, nconf.get('secret'), function (err, payload) {
		if (err) {
			return res.sendStatus(403);
		}

		switch (payload.template) {
		case 'digest':
			async.parallel([
				async.apply(user.setSetting, payload.uid, 'dailyDigestFreq', 'off'),
				async.apply(user.updateDigestSetting, payload.uid, 'off'),
			], function (err) {
				if (err) {
					winston.error('[settings/unsubscribe] One-click unsubscribe failed with error: ' + err.message);
					return res.sendStatus(500);
				}

				return res.sendStatus(200);
			});
			break;
		case 'notification':
			async.waterfall([
				async.apply(db.getObjectField, 'user:' + payload.uid + ':settings', 'notificationType_' + payload.type),
				(current, next) => {
					user.setSetting(payload.uid, 'notificationType_' + payload.type, (current === 'notificationemail' ? 'notification' : 'none'), next);
				},
			], function (err) {
				if (err) {
					winston.error('[settings/unsubscribe] One-click unsubscribe failed with error: ' + err.message);
					return res.sendStatus(500);
				}

				return res.sendStatus(200);
			});
			break;
		default:
			res.sendStatus(404);
			break;
		}
	});
};

function getNotificationSettings(userData, callback) {
	var privilegedTypes = [];

	async.waterfall([
		function (next) {
			user.getPrivileges(userData.uid, next);
		},
		function (privileges, next) {
			if (privileges.isAdmin) {
				privilegedTypes.push('notificationType_new-register');
			}
			if (privileges.isAdmin || privileges.isGlobalMod || privileges.isModeratorOfAnyCategory) {
				privilegedTypes.push('notificationType_post-queue', 'notificationType_new-post-flag');
			}
			if (privileges.isAdmin || privileges.isGlobalMod) {
				privilegedTypes.push('notificationType_new-user-flag');
			}
			plugins.fireHook('filter:user.notificationTypes', {
				types: notifications.baseTypes.slice(),
				privilegedTypes: privilegedTypes,
			}, next);
		},
		function (results, next) {
			function modifyType(type) {
				var setting = userData.settings[type];

				return {
					name: type,
					label: '[[notifications:' + type + ']]',
					none: setting === 'none',
					notification: setting === 'notification',
					email: setting === 'email',
					notificationemail: setting === 'notificationemail',
				};
			}

			if (meta.config.disableChat) {
				results.types = results.types.filter(type => type !== 'notificationType_new-chat');
			}

			var notificationSettings = results.types.map(modifyType).concat(results.privilegedTypes.map(modifyType));
			next(null, notificationSettings);
		},
	], callback);
}

function getHomePageRoutes(userData, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('cid:0:children', 0, -1, next);
		},
		function (cids, next) {
			privileges.categories.filterCids('find', cids, 0, next);
		},
		function (cids, next) {
			categories.getCategoriesFields(cids, ['name', 'slug'], next);
		},
		function (categoryData, next) {
			categoryData = categoryData.map(function (category) {
				return {
					route: 'category/' + category.slug,
					name: 'Category: ' + category.name,
				};
			});

			categoryData = categoryData || [];

			plugins.fireHook('filter:homepage.get', { routes: [
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
			].concat(categoryData, [
				{
					route: 'custom',
					name: 'Custom',
				},
			]) }, next);
		},
		function (data, next) {
			// Set selected for each route
			var customIdx;
			var hasSelected = false;
			data.routes = data.routes.map(function (route, idx) {
				if (route.route === userData.settings.homePageRoute) {
					route.selected = true;
					hasSelected = true;
				} else {
					route.selected = false;
				}

				if (route.route === 'custom') {
					customIdx = idx;
				}

				return route;
			});

			if (!hasSelected && customIdx && userData.settings.homePageRoute !== 'none') {
				data.routes[customIdx].selected = true;
			}

			next(null, data.routes);
		},
	], callback);
}
