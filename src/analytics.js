'use strict';

var cronJob = require('cron').CronJob;
var async = require('async');
var winston = require('winston');

var db = require('./database');

(function(Analytics) {
	var counters = {};

	var pageViews = 0;
	var uniqueIPCount = 0;
	var uniquevisitors = 0;

	var isCategory = /^(?:\/api)?\/category\/(\d+)/;

	new cronJob('*/10 * * * *', function() {
		Analytics.writeData();
	}, null, true);

	Analytics.increment = function(keys) {
		keys = Array.isArray(keys) ? keys : [keys];

		keys.forEach(function(key) {
			counters[key] = counters[key] || 0;
			++counters[key];
		});
	};

	Analytics.pageView = function(payload) {
		++pageViews;

		if (payload.ip) {
			db.sortedSetScore('ip:recent', payload.ip, function(err, score) {
				if (err) {
					return;
				}
				if (!score) {
					++uniqueIPCount;
				}
				var today = new Date();
				today.setHours(today.getHours(), 0, 0, 0);
				if (!score || score < today.getTime()) {
					++uniquevisitors;
					db.sortedSetAdd('ip:recent', Date.now(), payload.ip);
				}
			});
		}

		if (payload.path) {
			var categoryMatch = payload.path.match(isCategory),
				cid = categoryMatch ? parseInt(categoryMatch[1], 10) : null;

			if (cid) {
				Analytics.increment(['pageviews:byCid:' + cid]);
			}
		}
	};

	Analytics.writeData = function() {
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
			for(var key in counters) {
				if (counters.hasOwnProperty(key)) {					
					dbQueue.push(async.apply(db.sortedSetIncrBy, 'analytics:' + key, counters[key], today.getTime()));
					delete counters[key];
				}
			}
		}

		async.parallel(dbQueue, function(err) {
			if (err) {
				winston.error('[analytics] Encountered error while writing analytics to data store: ' + err.message);
			}
		});
	};

	Analytics.getHourlyStatsForSet = function(set, hour, numHours, callback) {
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
	};

	Analytics.getDailyStatsForSet = function(set, day, numDays, callback) {
		var daysArr = [];

		day = new Date(day);
		day.setDate(day.getDate()+1);	// set the date to tomorrow, because getHourlyStatsForSet steps *backwards* 24 hours to sum up the values
		day.setHours(0, 0, 0, 0);

		async.whilst(function() {
			return numDays--;
		}, function(next) {
			Analytics.getHourlyStatsForSet(set, day.getTime()-(1000*60*60*24*numDays), 24, function(err, day) {
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
	};

	Analytics.getUnwrittenPageviews = function() {
		return pageViews;
	};

	Analytics.getMonthlyPageViews = function(callback) {
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
	};

	Analytics.getCategoryAnalytics = function(cid, callback) {
		async.parallel({
			'pageviews:hourly': async.apply(Analytics.getHourlyStatsForSet, 'analytics:pageviews:byCid:' + cid, Date.now(), 24),
			'pageviews:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:pageviews:byCid:' + cid, Date.now(), 30),
			'topics:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:topics:byCid:' + cid, Date.now(), 7),
			'posts:daily': async.apply(Analytics.getDailyStatsForSet, 'analytics:posts:byCid:' + cid, Date.now(), 7),
		}, callback);
	};

}(exports));