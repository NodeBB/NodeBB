"use strict";

var	async = require('async'),
	winston = require('winston'),


	meta = require('../meta'),
	plugins = require('../plugins'),
	widgets = require('../widgets'),
	user = require('../user'),
	posts = require('../posts'),
	logger = require('../logger'),
	events = require('../events'),
	emailer = require('../emailer'),
	db = require('../database'),
	analytics = require('../analytics'),
	index = require('./index'),


	SocketAdmin = {
		user: require('./admin/user'),
		categories: require('./admin/categories'),
		groups: require('./admin/groups'),
		tags: require('./admin/tags'),
		rewards: require('./admin/rewards'),
		navigation: require('./admin/navigation'),
		rooms: require('./admin/rooms'),
		themes: {},
		plugins: {},
		widgets: {},
		config: {},
		settings: {},
		email: {},
		analytics: {},
		logs: {}
	};

SocketAdmin.before = function(socket, method, data, next) {
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
	events.log({
		type: 'reload',
		uid: socket.uid,
		ip: socket.ip
	});
	if (process.send) {
		process.send({
			action: 'reload'
		});
	} else {
		meta.reload(callback);
	}
};

SocketAdmin.restart = function(socket, data, callback) {
	events.log({
		type: 'restart',
		uid: socket.uid,
		ip: socket.ip
	});
	meta.restart();
};

SocketAdmin.fireEvent = function(socket, data, callback) {
	index.server.emit(data.name, data.payload || {});
};

SocketAdmin.themes.getInstalled = function(socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var wrappedCallback = function(err) {
		meta.themes.set(data, callback);
	};
	if (data.type === 'bootswatch') {
		wrappedCallback();
	} else {
		widgets.reset(wrappedCallback);
	}
};

SocketAdmin.plugins.toggleActive = function(socket, plugin_id, callback) {
	require('../posts/cache').reset();
	plugins.toggleActive(plugin_id, callback);
};

SocketAdmin.plugins.toggleInstall = function(socket, data, callback) {
	require('../posts/cache').reset();
	plugins.toggleInstall(data.id, data.version, callback);
};

SocketAdmin.plugins.getActive = function(socket, data, callback) {
	plugins.getActive(callback);
};

SocketAdmin.plugins.orderActivePlugins = function(socket, data, callback) {
	async.each(data, function(plugin, next) {
		if (plugin && plugin.name) {
			db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name, next);
		} else {
			next();
		}
	}, callback);
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

SocketAdmin.settings.clearSitemapCache = function(socket, data, callback) {
	require('../sitemap').clearCache();
	callback();
};

SocketAdmin.email.test = function(socket, data, callback) {
	var site_title = meta.config.title || 'NodeBB';
	emailer.send(data.template, socket.uid, {
		subject: '[' + site_title + '] Test Email',
		site_title: site_title
	}, callback);
};

SocketAdmin.analytics.get = function(socket, data, callback) {
	// Default returns views from past 24 hours, by hour
	if (data.units === 'days') {
		data.amount = 30;
	} else {
		data.amount = 24;
	}

	if (data && data.graph && data.units && data.amount) {
		if (data.graph === 'traffic') {
			async.parallel({
				uniqueVisitors: function(next) {
					if (data.units === 'days') {
						getDailyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
					} else {
						getHourlyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
					}
				},
				pageviews: function(next) {
					if (data.units === 'days') {
						getDailyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
					} else {
						getHourlyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
					}
				},
				monthlyPageViews: function(next) {
					analytics.getMonthlyPageViews(next);
				}
			}, function(err, data) {
				data.pastDay = data.pageviews.reduce(function(a, b) {return parseInt(a, 10) + parseInt(b, 10);});
				data.pageviews[data.pageviews.length - 1] = parseInt(data.pageviews[data.pageviews.length - 1], 10) + analytics.getUnwrittenPageviews();
				callback(err, data);
			});
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

function getHourlyStatsForSet(set, hour, numHours, callback) {
	var terms = {},
		hoursArr = [];

	hour = new Date(hour);
	hour.setHours(hour.getHours(), 0, 0, 0);

	for (var i = 0, ii = numHours; i < ii; i++) {
		hoursArr.push(hour.getTime());
		hour.setHours(hour.getHours() - 1, 0, 0, 0);
	}

	db.sortedSetScores(set, hoursArr, function(err, counts) {
		if (err) {
			return callback(err);
		}

		hoursArr.forEach(function(term, index) {
			terms[term] = parseInt(counts[index], 10) || 0;
		});

		var termsArr = [];

		hoursArr.reverse();
		hoursArr.forEach(function(hour) {
			termsArr.push(terms[hour]);
		});

		callback(null, termsArr);
	});
}

function getDailyStatsForSet(set, day, numDays, callback) {
	var daysArr = [];

	day = new Date(day);
	day.setHours(0, 0, 0, 0);

	async.whilst(function() {
		return numDays--;
	}, function(next) {
		getHourlyStatsForSet(set, day.getTime()-(1000*60*60*24*numDays), 24, function(err, day) {
			if (err) {
				return next(err);
			}

			daysArr.push(day.reduce(function(cur, next) {
				return cur+next;
			}));
			next();
		});
	}, function(err) {
		callback(err, daysArr);
	});
}

SocketAdmin.getMoreEvents = function(socket, next, callback) {
	var start = parseInt(next, 10);
	if (start < 0) {
		return callback(null, {data: [], next: next});
	}
	var stop = start + 10;
	events.getEvents(start, stop, function(err, events) {
		if (err) {
			return callback(err);
		}
		callback(null, {events: events, next: stop + 1});
	});
};

SocketAdmin.deleteAllEvents = function(socket, data, callback) {
	events.deleteAll(callback);
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

SocketAdmin.getMoreFlags = function(socket, data, callback) {
	if (!data || !parseInt(data.after, 10)) {
		return callback('[[error:invalid-data]]');
	}
	var sortBy = data.sortBy || 'count';
	var byUsername = data.byUsername ||  '';
	var start = parseInt(data.after, 10);
	var stop = start + 19;
	if (byUsername) {
		posts.getUserFlags(byUsername, sortBy, socket.uid, start, stop, function(err, posts) {
			callback(err, {posts: posts, next: stop + 1});
		});
	} else {
		var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
		posts.getFlags(set, socket.uid, start, stop, function(err, posts) {
			callback(err, {posts: posts, next: stop + 1});
		});
	}
};

module.exports = SocketAdmin;
