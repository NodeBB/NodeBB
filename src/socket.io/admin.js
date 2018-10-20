'use strict';

var async = require('async');
var winston = require('winston');
var fs = require('fs');
var path = require('path');
var nconf = require('nconf');

var meta = require('../meta');
var plugins = require('../plugins');
var widgets = require('../widgets');
var user = require('../user');
var userDigest = require('../user/digest');
var userEmail = require('../user/email');
var logger = require('../logger');
var events = require('../events');
var emailer = require('../emailer');
var db = require('../database');
var analytics = require('../analytics');
var websockets = require('../socket.io/index');
var index = require('./index');
var getAdminSearchDict = require('../admin/search').getDictionary;
var utils = require('../../public/src/utils');

var SocketAdmin = {
	user: require('./admin/user'),
	categories: require('./admin/categories'),
	groups: require('./admin/groups'),
	tags: require('./admin/tags'),
	rewards: require('./admin/rewards'),
	navigation: require('./admin/navigation'),
	rooms: require('./admin/rooms'),
	social: require('./admin/social'),
	themes: {},
	plugins: {},
	widgets: {},
	config: {},
	settings: {},
	email: {},
	analytics: {},
	logs: {},
	errors: {},
	uploads: {},
};

SocketAdmin.before = function (socket, method, data, next) {
	async.waterfall([
		function (next) {
			user.isAdministrator(socket.uid, next);
		},
		function (isAdmin) {
			if (isAdmin) {
				return next();
			}
			winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
			next(new Error('[[error:no-privileges]]'));
		},
	], next);
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

SocketAdmin.reload = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			require('../meta/build').buildAll(next);
		},
		function (next) {
			events.log({
				type: 'build',
				uid: socket.uid,
				ip: socket.ip,
			});

			logRestart(socket);
			meta.restart();
			next();
		},
	], callback);
};

SocketAdmin.fireEvent = function (socket, data, callback) {
	index.server.emit(data.name, data.payload || {});
	callback();
};

SocketAdmin.themes.getInstalled = function (socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			if (data.type === 'bootswatch') {
				setImmediate(next);
			} else {
				widgets.reset(next);
			}
		},
		function (next) {
			// Add uid and ip data
			data.ip = socket.ip;
			data.uid = socket.uid;

			meta.themes.set(data, next);
		},
	], callback);
};

SocketAdmin.plugins.toggleActive = function (socket, plugin_id, callback) {
	require('../posts/cache').reset();
	plugins.toggleActive(plugin_id, callback);
};

SocketAdmin.plugins.toggleInstall = function (socket, data, callback) {
	require('../posts/cache').reset();
	plugins.toggleInstall(data.id, data.version, callback);
};

SocketAdmin.plugins.getActive = function (socket, data, callback) {
	plugins.getActive(callback);
};

SocketAdmin.plugins.orderActivePlugins = function (socket, data, callback) {
	async.each(data, function (plugin, next) {
		if (plugin && plugin.name) {
			db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name, next);
		} else {
			setImmediate(next);
		}
	}, callback);
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

SocketAdmin.config.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var _data = {};
	_data[data.key] = data.value;
	SocketAdmin.config.setMultiple(socket, _data, callback);
};

SocketAdmin.config.setMultiple = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var changes = {};
	Object.keys(data).forEach(function (key) {
		if (data[key] !== meta.config[key]) {
			changes[key] = data[key];
			changes[key + '_old'] = meta.config[key];
		}
	});

	async.waterfall([
		function (next) {
			meta.configs.setMultiple(data, next);
		},
		function (next) {
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
				events.log(changes, next);
			} else {
				next();
			}
		},
	], callback);
};

SocketAdmin.config.remove = function (socket, key, callback) {
	meta.configs.remove(key, callback);
};

SocketAdmin.settings.get = function (socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

SocketAdmin.settings.set = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			meta.settings.set(data.hash, data.values, next);
		},
		function (next) {
			var eventData = data.values;
			eventData.type = 'settings-change';
			eventData.uid = socket.uid;
			eventData.ip = socket.ip;
			eventData.hash = data.hash;
			events.log(eventData, next);
		},
	], callback);
};

SocketAdmin.settings.clearSitemapCache = function (socket, data, callback) {
	require('../sitemap').clearCache();
	callback();
};

SocketAdmin.email.test = function (socket, data, callback) {
	var payload = {
		subject: 'Test Email',
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

	if (data.graph === 'traffic') {
		async.parallel({
			uniqueVisitors: function (next) {
				if (data.units === 'days') {
					analytics.getDailyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
				} else {
					analytics.getHourlyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
				}
			},
			pageviews: function (next) {
				if (data.units === 'days') {
					analytics.getDailyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
				} else {
					analytics.getHourlyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
				}
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

SocketAdmin.deleteAllEvents = function (socket, data, callback) {
	events.deleteAll(callback);
};

SocketAdmin.getSearchDict = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.getSettings(socket.uid, next);
		},
		function (settings, next) {
			var lang = settings.userLang || meta.config.defaultLang || 'en-GB';
			getAdminSearchDict(lang, next);
		},
	], callback);
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

module.exports = SocketAdmin;
