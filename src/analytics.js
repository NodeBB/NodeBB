'use strict';

const cronJob = require('cron').CronJob;
const winston = require('winston');
const nconf = require('nconf');
const crypto = require('crypto');
const util = require('util');
const _ = require('lodash');

const sleep = util.promisify(setTimeout);

const db = require('./database');
const utils = require('./utils');
const plugins = require('./plugins');
const meta = require('./meta');
const pubsub = require('./pubsub');
const cacheCreate = require('./cache/lru');

const Analytics = module.exports;

const secret = nconf.get('secret');

let local = {
	counters: {},
	pageViews: 0,
	pageViewsRegistered: 0,
	pageViewsGuest: 0,
	pageViewsBot: 0,
	uniqueIPCount: 0,
	uniquevisitors: 0,
};
const empty = _.cloneDeep(local);
const total = _.cloneDeep(local);

let ipCache;

const runJobs = nconf.get('runJobs');

Analytics.init = async function () {
	ipCache = cacheCreate({
		max: parseInt(meta.config['analytics:maxCache'], 10) || 500,
		ttl: 0,
	});

	new cronJob('*/10 * * * * *', (async () => {
		publishLocalAnalytics();
		if (runJobs) {
			await sleep(2000);
			await Analytics.writeData();
		}
	}), null, true);

	if (runJobs) {
		pubsub.on('analytics:publish', (data) => {
			incrementProperties(total, data.local);
		});
	}
};

function publishLocalAnalytics() {
	pubsub.publish('analytics:publish', {
		local: local,
	});
	local = _.cloneDeep(empty);
}

function incrementProperties(obj1, obj2) {
	for (const [key, value] of Object.entries(obj2)) {
		if (typeof value === 'object') {
			incrementProperties(obj1[key], value);
		} else if (utils.isNumber(value)) {
			obj1[key] = obj1[key] || 0;
			obj1[key] += obj2[key];
		}
	}
}

Analytics.increment = function (keys, callback) {
	keys = Array.isArray(keys) ? keys : [keys];

	plugins.hooks.fire('action:analytics.increment', { keys: keys });

	keys.forEach((key) => {
		local.counters[key] = local.counters[key] || 0;
		local.counters[key] += 1;
	});

	if (typeof callback === 'function') {
		callback();
	}
};

Analytics.getKeys = async () => db.getSortedSetRange('analyticsKeys', 0, -1);

Analytics.pageView = async function (payload) {
	local.pageViews += 1;

	if (payload.uid > 0) {
		local.pageViewsRegistered += 1;
	} else if (payload.uid < 0) {
		local.pageViewsBot += 1;
	} else {
		local.pageViewsGuest += 1;
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
			local.uniqueIPCount += 1;
		}
		const today = new Date();
		today.setHours(today.getHours(), 0, 0, 0);
		if (!score || score < today.getTime()) {
			local.uniquevisitors += 1;
			await db.sortedSetAdd('ip:recent', Date.now(), hash);
		}
	}
};

Analytics.writeData = async function () {
	const today = new Date();
	const month = new Date();
	const dbQueue = [];
	const incrByBulk = [];

	// Build list of metrics that were updated
	let metrics = [
		'pageviews',
		'pageviews:month',
	];
	metrics.forEach((metric) => {
		const toAdd = ['registered', 'guest', 'bot'].map(type => `${metric}:${type}`);
		metrics = [...metrics, ...toAdd];
	});
	metrics.push('uniquevisitors');

	today.setHours(today.getHours(), 0, 0, 0);
	month.setMonth(month.getMonth(), 1);
	month.setHours(0, 0, 0, 0);

	if (total.pageViews > 0) {
		incrByBulk.push(['analytics:pageviews', total.pageViews, today.getTime()]);
		incrByBulk.push(['analytics:pageviews:month', total.pageViews, month.getTime()]);
		total.pageViews = 0;
	}

	if (total.pageViewsRegistered > 0) {
		incrByBulk.push(['analytics:pageviews:registered', total.pageViewsRegistered, today.getTime()]);
		incrByBulk.push(['analytics:pageviews:month:registered', total.pageViewsRegistered, month.getTime()]);
		total.pageViewsRegistered = 0;
	}

	if (total.pageViewsGuest > 0) {
		incrByBulk.push(['analytics:pageviews:guest', total.pageViewsGuest, today.getTime()]);
		incrByBulk.push(['analytics:pageviews:month:guest', total.pageViewsGuest, month.getTime()]);
		total.pageViewsGuest = 0;
	}

	if (total.pageViewsBot > 0) {
		incrByBulk.push(['analytics:pageviews:bot', total.pageViewsBot, today.getTime()]);
		incrByBulk.push(['analytics:pageviews:month:bot', total.pageViewsBot, month.getTime()]);
		total.pageViewsBot = 0;
	}

	if (total.uniquevisitors > 0) {
		incrByBulk.push(['analytics:uniquevisitors', total.uniquevisitors, today.getTime()]);
		total.uniquevisitors = 0;
	}

	if (total.uniqueIPCount > 0) {
		dbQueue.push(db.incrObjectFieldBy('global', 'uniqueIPCount', total.uniqueIPCount));
		total.uniqueIPCount = 0;
	}

	for (const [key, value] of Object.entries(total.counters)) {
		incrByBulk.push([`analytics:${key}`, value, today.getTime()]);
		metrics.push(key);
		delete total.counters[key];
	}

	if (incrByBulk.length) {
		dbQueue.push(db.sortedSetIncrByBulk(incrByBulk));
	}

	// Update list of tracked metrics
	dbQueue.push(db.sortedSetAdd('analyticsKeys', metrics.map(() => +Date.now()), metrics));

	try {
		await Promise.all(dbQueue);
	} catch (err) {
		winston.error(`[analytics] Encountered error while writing analytics to data store\n${err.stack}`);
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
		hoursArr.push(hour.getTime() - (i * 3600 * 1000));
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

	day = new Date(day);
	// set the date to tomorrow, because getHourlyStatsForSet steps *backwards* 24 hours to sum up the values
	day.setDate(day.getDate() + 1);
	day.setHours(0, 0, 0, 0);

	async function getHourlyStats(hour) {
		const dayData = await Analytics.getHourlyStatsForSet(
			set,
			hour,
			24
		);
		return dayData.reduce((cur, next) => cur + next);
	}
	const hours = [];
	while (numDays > 0) {
		hours.push(day.getTime() - (1000 * 60 * 60 * 24 * (numDays - 1)));
		numDays -= 1;
	}

	return await Promise.all(hours.map(getHourlyStats));
};

Analytics.getUnwrittenPageviews = function () {
	return local.pageViews;
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
