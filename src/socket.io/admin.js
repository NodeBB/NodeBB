"use strict";

var	async = require('async'),
	winston = require('winston'),
	fs = require('fs'),
	path = require('path'),

	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	widgets = require('../widgets'),
	user = require('../user'),
	topics = require('../topics'),
	posts = require('../posts'),
	categories = require('../categories'),
	logger = require('../logger'),
	events = require('../events'),
	emailer = require('../emailer'),
	db = require('../database'),
	index = require('./index'),


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
		analytics: {},
		logs: {}
	};

SocketAdmin.before = function(socket, method, next) {
	if (!socket.uid) {
		return;
	}
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
	if (process.send) {
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

SocketAdmin.plugins.toggleInstall = function(socket, data, callback) {
	plugins.toggleInstall(data.id, data.version, callback);
};

SocketAdmin.plugins.upgrade = function(socket, data, callback) {
	plugins.upgrade(data.id, data.version, callback);
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
			site_title: meta.config.title || 'NodeBB'
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
					getHourlyStatsForSet('analytics:uniquevisitors', data.amount, next);
				},
				pageviews: function(next) {
					getHourlyStatsForSet('analytics:pageviews', data.amount, next);
				},
				monthlyPageViews: function(next) {
					getMonthlyPageViews(next);
				}
			}, callback);
		}
	} else {
		callback(new Error('Invalid analytics call'));
	}
};

SocketAdmin.logs.get = function(socket, data, callback) {
	meta.logs.get(callback);
};

SocketAdmin.logs.clear = function(socket, data, callback) {
	meta.logs.clear(callback);
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

	db.sortedSetScores(set, hoursArr, function(err, counts) {
		if (err) {
			return callback(err);
		}

		hoursArr.forEach(function(term, index) {
			terms[term] = counts[index] || 0;
		});

		var termsArr = [];

		hoursArr.reverse();
		hoursArr.forEach(function(hour, idx) {
			termsArr.push(terms[hour]);
		});

		callback(null, termsArr);
	});
}

function getMonthlyPageViews(callback) {
	var thisMonth = new Date();
	var lastMonth = new Date();
	thisMonth.setMonth(thisMonth.getMonth(), 1);
	thisMonth.setHours(0, 0, 0, 0);
	lastMonth.setMonth(thisMonth.getMonth() - 1, 1);
	lastMonth.setHours(0, 0, 0, 0);

	var values = [thisMonth.getTime(), lastMonth.getTime()];

	db.sortedSetScores('analytics:pageviews:month', values, function(err, scores) {
		if (err) {
			return callback(err);
		}
		callback(null, {thisMonth: scores[0] || 0, lastMonth: scores[1] || 0});
	});
}

SocketAdmin.getMoreEvents = function(socket, next, callback) {
	if (parseInt(next, 10) < 0) {
		return callback(null, {data: [], next: next});
	}
	events.getLog(next, 5000, callback);
};

SocketAdmin.dismissFlag = function(socket, pid, callback) {
	if (!pid) {
		return callback('[[error:invalid-data]]');
	}

	posts.dismissFlag(pid, callback);
};

SocketAdmin.dismissAllFlags = function(socket, data, callback) {
	posts.dismissAllFlags(callback);
};

SocketAdmin.getMoreFlags = function(socket, after, callback) {
	if (!parseInt(after, 10)) {
		return callback('[[error:invalid-data]]');
	}
	after = parseInt(after, 10);
	posts.getFlags(socket.uid, after, after + 19, function(err, posts) {
		callback(err, {posts: posts, next: after + 20});
	});
};

SocketAdmin.takeHeapSnapshot = function(socket, data, callback) {
	require('heapdump').writeSnapshot(callback);
};

module.exports = SocketAdmin;
