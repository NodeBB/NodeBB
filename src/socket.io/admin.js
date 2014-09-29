"use strict";

var	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	widgets = require('../widgets'),
	user = require('../user'),
	topics = require('../topics'),
	categories = require('../categories'),
	logger = require('../logger'),
	events = require('../events'),
	emailer = require('../emailer'),
	db = require('../database'),
	async = require('async'),
	winston = require('winston'),
	index = require('./index'),
	cluster = require('cluster'),

	SocketAdmin = {
		user: require('./admin/user'),
		categories: require('./admin/categories'),
		groups: require('./admin/groups'),
		tags: require('./admin/tags'),
		themes: {},
		plugins: {},
		widgets: {},
		config: {},
		settings: {},
		email: {},
		analytics: {}
	};

SocketAdmin.before = function(socket, method, next) {
	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (!err && isAdmin) {
			next();
		} else {
			winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
		}
	});
};

SocketAdmin.reload = function(socket, data, callback) {
	events.logWithUser(socket.uid, ' is reloading NodeBB');
	if (cluster.isWorker) {
		process.send({
			action: 'reload'
		});
	} else {
		meta.reload(callback);
	}
};

SocketAdmin.restart = function(socket, data, callback) {
	events.logWithUser(socket.uid, ' is restarting NodeBB');
	meta.restart();
};

SocketAdmin.fireEvent = function(socket, data, callback) {
	index.server.sockets.emit(data.name, data.payload || {});
};

SocketAdmin.themes.getInstalled = function(socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var wrappedCallback = function(err) {
		meta.themes.set(data, function() {
			callback();
		});
	};
	if (data.type === 'bootswatch') {
		wrappedCallback();
	} else {
		widgets.reset(wrappedCallback);
	}
};

SocketAdmin.themes.updateBranding = function(socket, data, callback) {
	meta.css.updateBranding();
};

SocketAdmin.plugins.toggleActive = function(socket, plugin_id, callback) {
	plugins.toggleActive(plugin_id, callback);
};

SocketAdmin.plugins.toggleInstall = function(socket, plugin_id, callback) {
	plugins.toggleInstall(plugin_id, callback);
};

SocketAdmin.widgets.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	widgets.setArea(data, callback);
};

SocketAdmin.config.get = function(socket, data, callback) {
	meta.configs.list(callback);
};

SocketAdmin.config.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	meta.configs.set(data.key, data.value, function(err) {
		if(err) {
			return callback(err);
		}

		callback(null);

		plugins.fireHook('action:config.set', {
			key: data.key,
			value: data.value
		});

		logger.monitorConfig({io: index.server}, data);
	});
};

SocketAdmin.config.setMultiple = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	meta.configs.setMultiple(data, function(err) {
		if(err) {
			return callback(err);
		}

		callback();
		var setting;
		for(var field in data) {
			if (data.hasOwnProperty(field)) {
				setting = {
					key: field,
					value: data[field]
				};
				plugins.fireHook('action:config.set', setting);
				logger.monitorConfig({io: index.server}, setting);
			}
		}
	});
};

SocketAdmin.config.remove = function(socket, key) {
	meta.configs.remove(key);
};

SocketAdmin.settings.get = function(socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

SocketAdmin.settings.set = function(socket, data, callback) {
	meta.settings.set(data.hash, data.values, callback);
};

SocketAdmin.email.test = function(socket, data, callback) {
	if (plugins.hasListeners('action:email.send')) {
		emailer.send('test', socket.uid, {
			subject: '[NodeBB] Test Email',
			site_title: meta.config.site_title || 'NodeBB'
		});
		callback();
	} else {
		callback(new Error('[[error:no-emailers-configured]]'));
	}
};

SocketAdmin.analytics.get = function(socket, data, callback) {
	data.units = 'hours'; // temp
	data.amount = 12;

	if (data && data.graph && data.units && data.amount) {
		if (data.graph === 'traffic') {
			async.parallel({
				uniqueVisitors: function(next) {
					getHourlyStatsForSet('ip:recent', data.amount, next);
				},
				pageviews: function(next) {
					getHourlyStatsForSet('analytics:pageviews', data.amount, next);
				}
			}, callback);
		}
	} else {
		callback(new Error('Invalid analytics call'));
	}
};

function getHourlyStatsForSet(set, hours, callback) {
	var hour = new Date(),
		terms = {},
		hoursArr = [];

	hour.setHours(hour.getHours(), 0, 0, 0);

	for (var i = 0, ii = hours; i < ii; i++) {
		hoursArr.push(hour.getTime());
		hour.setHours(hour.getHours() - 1, 0, 0, 0);
	}

	async.each(hoursArr, function(term, next) {
		if (set.indexOf('analytics') !== -1) {
			db.sortedSetScore(set, term, function(err, count) {
				terms[term] = count || 0;
				next(err);
			});
		} else {
			db.sortedSetCount(set, term, Date.now(), function(err, count) {
				terms[term] = count || 0;
				next(err);
			});
		}

	}, function(err) {
		var termsArr = [];

		hoursArr.reverse();
		hoursArr.forEach(function(hour, idx) {
			termsArr.push(terms[hour]);
		});

		callback(err, termsArr);
	});
}

module.exports = SocketAdmin;
