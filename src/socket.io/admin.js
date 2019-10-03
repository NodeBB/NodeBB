'use strict';

const async = require('async');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

const meta = require('../meta');
const plugins = require('../plugins');
const widgets = require('../widgets');
const user = require('../user');
const userDigest = require('../user/digest');
const userEmail = require('../user/email');
const logger = require('../logger');
const events = require('../events');
const notifications = require('../notifications');
const emailer = require('../emailer');
const db = require('../database');
const analytics = require('../analytics');
const websockets = require('../socket.io/index');
const index = require('./index');
const getAdminSearchDict = require('../admin/search').getDictionary;
const utils = require('../../public/src/utils');

const SocketAdmin = module.exports;
SocketAdmin.user = require('./admin/user');
SocketAdmin.categories = require('./admin/categories');
SocketAdmin.groups = require('./admin/groups');
SocketAdmin.tags = require('./admin/tags');
SocketAdmin.rewards = require('./admin/rewards');
SocketAdmin.navigation = require('./admin/navigation');
SocketAdmin.rooms = require('./admin/rooms');
SocketAdmin.social = require('./admin/social');
SocketAdmin.themes = {};
SocketAdmin.plugins = {};
SocketAdmin.widgets = {};
SocketAdmin.config = {};
SocketAdmin.settings = {};
SocketAdmin.email = {};
SocketAdmin.analytics = {};
SocketAdmin.logs = {};
SocketAdmin.errors = {};
SocketAdmin.uploads = {};

SocketAdmin.before = async function (socket, method) {
	const isAdmin = await user.isAdministrator(socket.uid);
	if (isAdmin) {
		return;
	}
	winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
	throw new Error('[[error:no-privileges]]');
};

SocketAdmin.restart = function (socket, data, callback) {
	logRestart(socket);
	meta.restart();
	callback();
};

function logRestart(socket) {
	events.log({
		type: 'restart',
		uid: socket.uid,
		ip: socket.ip,
	});
	db.setObject('lastrestart', {
		uid: socket.uid,
		ip: socket.ip,
		timestamp: Date.now(),
	});
}

SocketAdmin.reload = async function (socket) {
	await require('../meta/build').buildAll();
	await events.log({
		type: 'build',
		uid: socket.uid,
		ip: socket.ip,
	});

	logRestart(socket);
	meta.restart();
};

SocketAdmin.fireEvent = function (socket, data, callback) {
	index.server.emit(data.name, data.payload || {});
	callback();
};

SocketAdmin.themes.getInstalled = function (socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (data.type === 'local') {
		await widgets.reset();
	}

	data.ip = socket.ip;
	data.uid = socket.uid;

	await meta.themes.set(data);
};

SocketAdmin.plugins.toggleActive = async function (socket, plugin_id) {
	require('../posts/cache').reset();
	const data = await plugins.toggleActive(plugin_id);
	await events.log({
		type: 'plugin-' + (data.active ? 'activate' : 'deactivate'),
		text: plugin_id,
		uid: socket.uid,
	});
	return data;
};

SocketAdmin.plugins.toggleInstall = async function (socket, data) {
	require('../posts/cache').reset();
	const pluginData = await plugins.toggleInstall(data.id, data.version);
	await events.log({
		type: 'plugin-' + (pluginData.installed ? 'install' : 'uninstall'),
		text: data.id,
		version: data.version,
		uid: socket.uid,
	});
	return pluginData;
};

SocketAdmin.plugins.getActive = function (socket, data, callback) {
	plugins.getActive(callback);
};

SocketAdmin.plugins.orderActivePlugins = async function (socket, data) {
	data = data.filter(plugin => plugin && plugin.name);
	await Promise.all(data.map(plugin => db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name)));
};

SocketAdmin.plugins.upgrade = function (socket, data, callback) {
	plugins.upgrade(data.id, data.version, callback);
};

SocketAdmin.widgets.set = function (socket, data, callback) {
	if (!Array.isArray(data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachSeries(data, widgets.setArea, callback);
};

SocketAdmin.config.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const _data = {};
	_data[data.key] = data.value;
	await SocketAdmin.config.setMultiple(socket, _data);
};

SocketAdmin.config.setMultiple = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	var changes = {};
	data = meta.configs.deserialize(data);
	Object.keys(data).forEach(function (key) {
		if (data[key] !== meta.config[key]) {
			changes[key] = data[key];
			changes[key + '_old'] = meta.config[key];
		}
	});
	await meta.configs.setMultiple(data);
	var setting;
	for (var field in data) {
		if (data.hasOwnProperty(field)) {
			setting = {
				key: field,
				value: data[field],
			};
			plugins.fireHook('action:config.set', setting);
			logger.monitorConfig({ io: index.server }, setting);
		}
	}
	if (Object.keys(changes).length) {
		changes.type = 'config-change';
		changes.uid = socket.uid;
		changes.ip = socket.ip;
		await events.log(changes);
	}
};

SocketAdmin.config.remove = function (socket, key, callback) {
	meta.configs.remove(key, callback);
};

SocketAdmin.settings.get = function (socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

SocketAdmin.settings.set = async function (socket, data) {
	await meta.settings.set(data.hash, data.values);
	const eventData = data.values;
	eventData.type = 'settings-change';
	eventData.uid = socket.uid;
	eventData.ip = socket.ip;
	eventData.hash = data.hash;
	await events.log(eventData);
};

SocketAdmin.settings.clearSitemapCache = function (socket, data, callback) {
	require('../sitemap').clearCache();
	callback();
};

SocketAdmin.email.test = function (socket, data, callback) {
	var payload = {
		subject: '[[email:test-email.subject]]',
	};

	switch (data.template) {
	case 'digest':
		userDigest.execute({
			interval: 'alltime',
			subscribers: [socket.uid],
		}, callback);
		break;

	case 'banned':
		Object.assign(payload, {
			username: 'test-user',
			until: utils.toISOString(Date.now()),
			reason: 'Test Reason',
		});
		emailer.send(data.template, socket.uid, payload, callback);
		break;

	case 'welcome':
		userEmail.sendValidationEmail(socket.uid, {
			force: 1,
		}, callback);
		break;

	case 'notification':
		async.waterfall([
			function (next) {
				notifications.create({
					type: 'test',
					bodyShort: '[[email:notif.test.short]]',
					bodyLong: '[[email:notif.test.long]]',
					nid: 'uid:' + socket.uid + ':test',
					path: '/',
					from: socket.uid,
				}, next);
			},
			function (notifObj, next) {
				emailer.send('notification', socket.uid, {
					path: notifObj.path,
					subject: utils.stripHTMLTags(notifObj.subject || '[[notifications:new_notification]]'),
					intro: utils.stripHTMLTags(notifObj.bodyShort),
					body: notifObj.bodyLong || '',
					notification: notifObj,
					showUnsubscribe: true,
				}, next);
			},
		], callback);
		break;

	default:
		emailer.send(data.template, socket.uid, payload, callback);
		break;
	}
};

SocketAdmin.analytics.get = function (socket, data, callback) {
	if (!data || !data.graph || !data.units) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	// Default returns views from past 24 hours, by hour
	if (!data.amount) {
		if (data.units === 'days') {
			data.amount = 30;
		} else {
			data.amount = 24;
		}
	}
	const getStats = data.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
	if (data.graph === 'traffic') {
		async.parallel({
			uniqueVisitors: function (next) {
				getStats('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
			},
			pageviews: function (next) {
				getStats('analytics:pageviews', data.until || Date.now(), data.amount, next);
			},
			pageviewsRegistered: function (next) {
				getStats('analytics:pageviews:registered', data.until || Date.now(), data.amount, next);
			},
			pageviewsGuest: function (next) {
				getStats('analytics:pageviews:guest', data.until || Date.now(), data.amount, next);
			},
			pageviewsBot: function (next) {
				getStats('analytics:pageviews:bot', data.until || Date.now(), data.amount, next);
			},
			summary: function (next) {
				analytics.getSummary(next);
			},
		}, function (err, data) {
			data.pastDay = data.pageviews.reduce(function (a, b) { return parseInt(a, 10) + parseInt(b, 10); });
			data.pageviews[data.pageviews.length - 1] = parseInt(data.pageviews[data.pageviews.length - 1], 10) + analytics.getUnwrittenPageviews();
			callback(err, data);
		});
	}
};

SocketAdmin.logs.get = function (socket, data, callback) {
	meta.logs.get(callback);
};

SocketAdmin.logs.clear = function (socket, data, callback) {
	meta.logs.clear(callback);
};

SocketAdmin.errors.clear = function (socket, data, callback) {
	meta.errors.clear(callback);
};

SocketAdmin.deleteEvents = function (socket, eids, callback) {
	events.deleteEvents(eids, callback);
};

SocketAdmin.deleteAllEvents = function (socket, data, callback) {
	events.deleteAll(callback);
};

SocketAdmin.getSearchDict = async function (socket) {
	const settings = await user.getSettings(socket.uid);
	var lang = settings.userLang || meta.config.defaultLang || 'en-GB';
	return await getAdminSearchDict(lang);
};

SocketAdmin.deleteAllSessions = function (socket, data, callback) {
	user.auth.deleteAllSessions(callback);
};

SocketAdmin.reloadAllSessions = function (socket, data, callback) {
	websockets.in('uid_' + socket.uid).emit('event:livereload');
	callback();
};

SocketAdmin.uploads.delete = function (socket, pathToFile, callback) {
	pathToFile = path.join(nconf.get('upload_path'), pathToFile);
	if (!pathToFile.startsWith(nconf.get('upload_path'))) {
		return callback(new Error('[[error:invalid-path]]'));
	}

	fs.unlink(pathToFile, callback);
};

require('../promisify')(SocketAdmin);
