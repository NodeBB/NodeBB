'use strict';

const nconf = require('nconf');
const winston = require('winston');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const util = require('util');

const user = require('../../user');
const languages = require('../../languages');
const meta = require('../../meta');
const plugins = require('../../plugins');
const notifications = require('../../notifications');
const db = require('../../database');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');

const settingsController = module.exports;

settingsController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}
	const [settings, languagesData, soundsMapping] = await Promise.all([
		user.getSettings(userData.uid),
		languages.list(),
		meta.sounds.getUserSoundMap(userData.uid),
	]);

	userData.settings = settings;
	userData.languages = languagesData;
	if (userData.isAdmin && userData.isSelf) {
		userData.acpLanguages = _.cloneDeep(languagesData);
	}

	addSoundSettings(userData, soundsMapping);

	const data = await plugins.fireHook('filter:user.customSettings', {
		settings: settings,
		customSettings: [],
		uid: req.uid,
	});

	const [notificationSettings, routes] = await Promise.all([
		getNotificationSettings(userData),
		getHomePageRoutes(userData),
	]);

	userData.customSettings = data.customSettings;
	userData.homePageRoutes = routes;
	userData.notificationSettings = notificationSettings;
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

	userData.disableCustomUserSkins = meta.config.disableCustomUserSkins || 0;

	userData.allowUserHomePage = meta.config.allowUserHomePage || 1;

	userData.hideFullname = meta.config.hideFullname || 0;
	userData.hideEmail = meta.config.hideEmail || 0;

	userData.inTopicSearchAvailable = plugins.hasListeners('filter:topic.search');

	userData.maxTopicsPerPage = meta.config.maxTopicsPerPage;
	userData.maxPostsPerPage = meta.config.maxPostsPerPage;

	userData.title = '[[pages:account/settings]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:settings]]' }]);

	res.render('account/settings', userData);
};

function addSoundSettings(userData, soundsMapping) {
	const types = [
		'notification',
		'chat-incoming',
		'chat-outgoing',
	];
	const aliases = {
		notification: 'notificationSound',
		'chat-incoming': 'incomingChatSound',
		'chat-outgoing': 'outgoingChatSound',
	};

	types.forEach(function (type) {
		const soundpacks = plugins.soundpacks.map(function (pack) {
			const sounds = Object.keys(pack.sounds).map(function (soundName) {
				const value = pack.name + ' | ' + soundName;
				return {
					name: soundName,
					value: value,
					selected: value === soundsMapping[type],
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
}

const unsubscribable = ['digest', 'notification'];
const jwtVerifyAsync = util.promisify(function (token, callback) {
	jwt.verify(token, nconf.get('secret'), (err, payload) => callback(err, payload));
});
const doUnsubscribe = async (payload) => {
	if (payload.template === 'digest') {
		await Promise.all([
			user.setSetting(payload.uid, 'dailyDigestFreq', 'off'),
			user.updateDigestSetting(payload.uid, 'off'),
		]);
	} else if (payload.template === 'notification') {
		const current = await db.getObjectField('user:' + payload.uid + ':settings', 'notificationType_' + payload.type);
		await user.setSetting(payload.uid, 'notificationType_' + payload.type, (current === 'notificationemail' ? 'notification' : 'none'));
	}
	return true;
};

settingsController.unsubscribe = async (req, res) => {
	let payload;
	try {
		payload = await jwtVerifyAsync(req.params.token);
		if (!payload || !unsubscribable.includes(payload.template)) {
			return;
		}
	} catch (err) {
		throw new Error(err);
	}

	try {
		await doUnsubscribe(payload);
		res.render('unsubscribe', {
			payload: payload,
		});
	} catch (err) {
		throw new Error(err);
	}
};

settingsController.unsubscribePost = async function (req, res) {
	let payload;
	try {
		payload = await jwtVerifyAsync(req.params.token);
		if (!payload || !unsubscribable.includes(payload.template)) {
			return res.sendStatus(404);
		}
	} catch (err) {
		return res.sendStatus(403);
	}
	try {
		await doUnsubscribe(payload);
		res.sendStatus(200);
	} catch (err) {
		winston.error('[settings/unsubscribe] One-click unsubscribe failed with error: ' + err.message);
		res.sendStatus(500);
	}
};

async function getNotificationSettings(userData) {
	const privilegedTypes = [];

	const privileges = await user.getPrivileges(userData.uid);
	if (privileges.isAdmin) {
		privilegedTypes.push('notificationType_new-register');
	}
	if (privileges.isAdmin || privileges.isGlobalMod || privileges.isModeratorOfAnyCategory) {
		privilegedTypes.push('notificationType_post-queue', 'notificationType_new-post-flag');
	}
	if (privileges.isAdmin || privileges.isGlobalMod) {
		privilegedTypes.push('notificationType_new-user-flag');
	}
	const results = await plugins.fireHook('filter:user.notificationTypes', {
		types: notifications.baseTypes.slice(),
		privilegedTypes: privilegedTypes,
	});

	function modifyType(type) {
		const setting = userData.settings[type];
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

	return results.types.map(modifyType).concat(results.privilegedTypes.map(modifyType));
}

async function getHomePageRoutes(userData) {
	let routes = await helpers.getHomePageRoutes(userData.uid);

	// Set selected for each route
	var customIdx;
	var hasSelected = false;
	routes = routes.map(function (route, idx) {
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
		routes[customIdx].selected = true;
	}

	return routes;
}
