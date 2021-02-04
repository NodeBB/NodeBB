'use strict';

const cronJob = require('cron').CronJob;
const winston = require('winston');
const nconf = require('nconf');
const crypto = require('crypto');
const LRU = require('lru-cache');


const db = require('./database');
const utils = require('./utils');
const plugins = require('./plugins');
const meta = require('./meta');

const Analytics = module.exports;

const secret = nconf.get('secret');

const counters = {};

let pageViews = 0;
let pageViewsRegistered = 0;
let pageViewsGuest = 0;
let pageViewsBot = 0;
let uniqueIPCount = 0;
let uniquevisitors = 0;
let ipCache;

Analytics.init = async function () {
	ipCache = new LRU({
		max: parseInt(meta.config['analytics:maxCache'], 10) || 500,
		length: function () { return 1; },
		maxAge: 0,
	});

	new cronJob('*/10 * * * * *', (() => {
		Analytics.writeData();
	}), null, true);
};

Analytics.increment = function (keys, callback) {
	keys = Array.isArray(keys) ? keys : [keys];

	plugins.hooks.fire('action:analytics.increment', { keys: keys });

	keys.forEach((key) => {
		counters[key] = counters[key] || 0;
		counters[key] += 1;
	});

	if (typeof callback === 'function') {
		callback();
	}
};

Analytics.pageView = async function (payload) {
	pageViews += 1;

	if (payload.uid > 0) {
		pageViewsRegistered += 1;
	} else if (payload.uid < 0) {
		pageViewsBot += 1;
	} else {
		pageViewsGuest += 1;
	}

	if (payload.ip) {
		// Retrieve hash or calculate if not present
		let hash = ipCache.get(payload.ip + secret);
		if (!hash) {
			hash = crypto.createHash('sha1').update(payload.ip + secret).digest('hex');
			ipCache.set(payload.ip + secret, hash);
		}

		const score = await db.sortedSetScore('ip:recent', hash);
		if (!score) {
			uniqueIPCount += 1;
		}
		const today = new Date();
		today.setHours(today.getHours(), 0, 0, 0);
		if (!score || score < today.getTime()) {
			uniquevisitors += 1;
			await db.sortedSetAdd('ip:recent', Date.now(), hash);
		}
	}
};

Analytics.writeData = async function () {
	const today = new Date();
	const month = new Date();
	const dbQueue = [];

	today.setHours(today.getHours(), 0, 0, 0);
	month.setMonth(month.getMonth(), 1);
	month.setHours(0, 0, 0, 0);

	if (pageViews > 0) {
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews', pageViews, today.getTime()));
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:month', pageViews, month.getTime()));
		pageViews = 0;
	}

	if (pageViewsRegistered > 0) {
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:registered', pageViewsRegistered, today.getTime()));
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:month:registered', pageViewsRegistered, month.getTime()));
		pageViewsRegistered = 0;
	}

	if (pageViewsGuest > 0) {
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:guest', pageViewsGuest, today.getTime()));
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:month:guest', pageViewsGuest, month.getTime()));
		pageViewsGuest = 0;
	}

	if (pageViewsBot > 0) {
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:bot', pageViewsBot, today.getTime()));
		dbQueue.push(db.sortedSetIncrBy('analytics:pageviews:month:bot', pageViewsBot, month.getTime()));
		pageViewsBot = 0;
	}

	if (uniquevisitors > 0) {
		dbQueue.push(db.sortedSetIncrBy('analytics:uniquevisitors', uniquevisitors, today.getTime()));
		uniquevisitors = 0;
	}

	if (uniqueIPCount > 0) {
		dbQueue.push(db.incrObjectFieldBy('global', 'uniqueIPCount', uniqueIPCount));
		uniqueIPCount = 0;
	}

	if (Object.keys(counters).length > 0) {
		for (const key in counters) {
			if (counters.hasOwnProperty(key)) {
				dbQueue.push(db.sortedSetIncrBy(`analytics:${key}`, counters[key], today.getTime()));
				delete counters[key];
			}
		}
	}
	try {
		await Promise.all(dbQueue);
	} catch (err) {
		winston.error(`[analytics] Encountered error while writing analytics to data store\n${err.stack}`);
		throw err;
	}
};

Analytics.getHourlyStatsForSet = async function (set, hour, numHours) {
	// Guard against accidental ommission of `analytics:` prefix
	if (!set.startsWith('analytics:')) {
		set = `analytics:${set}`;
	}

	const terms = {};
	const hoursArr = [];

	hour = new Date(hour);
	hour.setHours(hour.getHours(), 0, 0, 0);

	for (let i = 0, ii = numHours; i < ii; i += 1) {
		hoursArr.push(hour.getTime());
		hour.setHours(hour.getHours() - 1, 0, 0, 0);
	}

	const counts = await db.sortedSetScores(set, hoursArr);

	hoursArr.forEach((term, index) => {
		terms[term] = parseInt(counts[index], 10) || 0;
	});

	const termsArr = [];

	hoursArr.reverse();
	hoursArr.forEach((hour) => {
		termsArr.push(terms[hour]);
	});

	return termsArr;
};

Analytics.getDailyStatsForSet = async function (set, day, numDays) {
	// Guard against accidental ommission of `analytics:` prefix
	if (!set.startsWith('analytics:')) {
		set = `analytics:${set}`;
	}

	const daysArr = [];
	day = new Date(day);
	day.setDate(day.getDate() + 1);	// set the date to tomorrow, because getHourlyStatsForSet steps *backwards* 24 hours to sum up the values
	day.setHours(0, 0, 0, 0);

	while (numDays > 0) {
		/* eslint-disable no-await-in-loop */
		const dayData = await Analytics.getHourlyStatsForSet(set, day.getTime() - (1000 * 60 * 60 * 24 * (numDays - 1)), 24);
		daysArr.push(dayData.reduce((cur, next) => cur + next));
		numDays -= 1;
	}
	return daysArr;
};

Analytics.getUnwrittenPageviews = function () {
	return pageViews;
};

Analytics.getSummary = async function () {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const [seven, thirty] = await Promise.all([
		Analytics.getDailyStatsForSet('analytics:pageviews', today, 7),
		Analytics.getDailyStatsForSet('analytics:pageviews', today, 30),
	]);

	return {
		seven: seven.reduce((sum, cur) => sum + cur, 0),
		thirty: thirty.reduce((sum, cur) => sum + cur, 0),
	};
};

Analytics.getCategoryAnalytics = async function (cid) {
	return await utils.promiseParallel({
		'pageviews:hourly': Analytics.getHourlyStatsForSet(`analytics:pageviews:byCid:${cid}`, Date.now(), 24),
		'pageviews:daily': Analytics.getDailyStatsForSet(`analytics:pageviews:byCid:${cid}`, Date.now(), 30),
		'topics:daily': Analytics.getDailyStatsForSet(`analytics:topics:byCid:${cid}`, Date.now(), 7),
		'posts:daily': Analytics.getDailyStatsForSet(`analytics:posts:byCid:${cid}`, Date.now(), 7),
	});
};

Analytics.getErrorAnalytics = async function () {
	return await utils.promiseParallel({
		'not-found': Analytics.getDailyStatsForSet('analytics:errors:404', Date.now(), 7),
		toobusy: Analytics.getDailyStatsForSet('analytics:errors:503', Date.now(), 7),
	});
};

Analytics.getBlacklistAnalytics = async function () {
	return await utils.promiseParallel({
		daily: Analytics.getDailyStatsForSet('analytics:blacklist', Date.now(), 7),
		hourly: Analytics.getHourlyStatsForSet('analytics:blacklist', Date.now(), 24),
	});
};

require('./promisify')(Analytics);
