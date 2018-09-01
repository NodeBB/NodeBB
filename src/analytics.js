'use strict';

var cronJob = require('cron').CronJob;
var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var crypto = require('crypto');

var db = require('./database');
var plugins = require('./plugins');

var Analytics = module.exports;

var counters = {};

var pageViews = 0;
var uniqueIPCount = 0;
var uniquevisitors = 0;

/**
 * TODO: allow the cache's max value to be configurable. On high-traffic installs,
 * the cache could be exhausted continuously if there are more than 500 concurrently
 * active users
 */
var LRU = require('lru-cache');
var ipCache = LRU({
	max: 500,
	length: function () { return 1; },
	maxAge: 0,
});

new cronJob('*/10 * * * * *', function () {
	Analytics.writeData();
}, null, true);

Analytics.increment = function (keys, callback) {
	keys = Array.isArray(keys) ? keys : [keys];

	plugins.fireHook('action:analytics.increment', { keys: keys });

	keys.forEach(function (key) {
		counters[key] = counters[key] || 0;
		counters[key] += 1;
	});

	if (typeof callback === 'function') {
		callback();
	}
};

Analytics.pageView = function (payload) {
	pageViews += 1;

	if (payload.ip) {
		// Retrieve hash or calculate if not present
		let hash = ipCache.get(payload.ip + nconf.get('secret'));
		if (!hash) {
			hash = crypto.createHash('sha1').update(payload.ip + nconf.get('secret')).digest('hex');
			ipCache.set(payload.ip + nconf.get('secret'), hash);
		}

		db.sortedSetScore('ip:recent', hash, function (err, score) {
			if (err) {
				return;
			}
			if (!score) {
				uniqueIPCount += 1;
			}
			var today = new Date();
			today.setHours(today.getHours(), 0, 0, 0);
			if (!score || score < today.getTime()) {
				uniquevisitors += 1;
				db.sortedSetAdd('ip:recent', Date.now(), hash);
			}
		});
	}
};

Analytics.writeData = function (callback) {
	callback = callback || function () {};
	var today = new Date();
	var month = new Date();
	var dbQueue = [];

	today.setHours(today.getHours(), 0, 0, 0);
	month.setMonth(month.getMonth(), 1);
	month.setHours(0, 0, 0, 0);

	if (pageViews > 0) {
		dbQueue.push(async.apply(db.sortedSetIncrBy, 'analytics:pageviews', pageViews, today.getTime()));
		dbQueue.push(async.apply(db.sortedSetIncrBy, 'analytics:pageviews:month', pageViews, month.getTime()));
		pageViews = 0;
	}

	if (uniquevisitors > 0) {
		dbQueue.push(async.apply(db.sortedSetIncrBy, 'analytics:uniquevisitors', uniquevisitors, today.getTime()));
		uniquevisitors = 0;
	}

	if (uniqueIPCount > 0) {
		dbQueue.push(async.apply(db.incrObjectFieldBy, 'global', 'uniqueIPCount', uniqueIPCount));
		uniqueIPCount = 0;
	}

	if (Object.keys(counters).length > 0) {
		for (var key in counters) {
			if (counters.hasOwnProperty(key)) {
				dbQueue.push(async.apply(db.sortedSetIncrBy, 'analytics:' + key, counters[key], today.getTime()));
				delete counters[key];
			}
		}
	}

	async.parallel(dbQueue, function (err) {
		if (err) {
			winston.error('[analytics] Encountered error while writing analytics to data store', err);
		}
		callback(err);
	});
};

Analytics.getHourlyStatsForSet = function (set, hour, numHours, callback) {
	var terms = {};
	var hoursArr = [];

	hour = new Date(hour);
	hour.setHours(hour.getHours(), 0, 0, 0);

	for (var i = 0, ii = numHours; i < ii; i += 1) {
		hoursArr.push(hour.getTime());
		hour.setHours(hour.getHours() - 1, 0, 0, 0);
	}

	db.sortedSetScores(set, hoursArr, function (err, counts) {
		if (err) {
			return callback(err);
		}

		hoursArr.forEach(function (term, index) {
			terms[term] = parseInt(counts[index], 10) || 0;
		});

		var termsArr = [];

		hoursArr.reverse();
		hoursArr.forEach(function (hour) {
			termsArr.push(terms[hour]);
		});

		callback(null, termsArr);
	});
};

Analytics.getDailyStatsForSet = function (set, day, numDays, callback) {
	var daysArr = [];

	day = new Date(day);
	day.setDate(day.getDate() + 1);	// set the date to tomorrow, because getHourlyStatsForSet steps *backwards* 24 hours to sum up the values
	day.setHours(0, 0, 0, 0);

	async.whilst(function () {
		numDays -= 1;
		return numDays + 1;
	}, function (next) {
		Analytics.getHourlyStatsForSet(set, day.getTime() - (1000 * 60 * 60 * 24 * numDays), 24, function (err, day) {
			if (err) {
				return next(err);
			}

			daysArr.push(day.reduce(function (cur, next) {
				return cur + next;
			}));
			next();
		});
	}, function (err) {
		callback(err, daysArr);
	});
};

Analytics.getUnwrittenPageviews = function () {
	return pageViews;
};

Analytics.getSummary = function (callback) {
	var today = new Date();
	today.setHours(0, 0, 0, 0);

	async.parallel({
		seven: async.apply(Analytics.getDailyStatsForSet, 'analytics:pageviews', today, 7),
		thirty: async.apply(Analytics.getDailyStatsForSet, 'analytics:pageviews', today, 30),
	}, function (err, scores) {
		if (err) {
			return callback(null, {
				seven: 0,
				thirty: 0,
			});
		}
		callback(null, {
			seven: scores.seven.reduce(function (sum, cur) {
				sum += cur;
				return sum;
			}, 0),
			thirty: scores.thirty.reduce(function (sum, cur) {
				sum += cur;
				return sum;
			}, 0),
		});
	});
};

Analytics.getCategoryAnalytics = function (cid, callback) {
	async.parallel({
		'pageviews:hourly': async.apply(Analytics.getHourlyStatsForSet, 'analytics:pageviews:byCid:' + cid, Date.now(), 24),
		'pageviews:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:pageviews:byCid:' + cid, Date.now(), 30),
		'topics:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:topics:byCid:' + cid, Date.now(), 7),
		'posts:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:posts:byCid:' + cid, Date.now(), 7),
	}, callback);
};

Analytics.getErrorAnalytics = function (callback) {
	async.parallel({
		'not-found': async.apply(Analytics.getDailyStatsForSet, 'analytics:errors:404', Date.now(), 7),
		toobusy: async.apply(Analytics.getDailyStatsForSet, 'analytics:errors:503', Date.now(), 7),
	}, callback);
};

Analytics.getBlacklistAnalytics = function (callback) {
	async.parallel({
		daily: async.apply(Analytics.getDailyStatsForSet, 'analytics:blacklist', Date.now(), 7),
		hourly: async.apply(Analytics.getHourlyStatsForSet, 'analytics:blacklist', Date.now(), 24),
	}, callback);
};
