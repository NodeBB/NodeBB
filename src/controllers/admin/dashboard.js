'use strict';

const nconf = require('nconf');
const semver = require('semver');
const winston = require('winston');
const _ = require('lodash');

const versions = require('../../admin/versions');
const db = require('../../database');
const meta = require('../../meta');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const user = require('../../user');
const utils = require('../../utils');

const dashboardController = module.exports;

dashboardController.get = async function (req, res) {
	const [stats, notices, latestVersion, lastrestart, isAdmin] = await Promise.all([
		getStats(),
		getNotices(),
		getLatestVersion(),
		getLastRestart(),
		user.isAdministrator(req.uid),
	]);
	const version = nconf.get('version');

	res.render('admin/dashboard', {
		version: version,
		lookupFailed: latestVersion === null,
		latestVersion: latestVersion,
		upgradeAvailable: latestVersion && semver.gt(latestVersion, version),
		currentPrerelease: versions.isPrerelease.test(version),
		notices: notices,
		stats: stats,
		canRestart: !!process.send,
		lastrestart: lastrestart,
		showSystemControls: isAdmin,
	});
};

async function getNotices() {
	const notices = [
		{
			done: !meta.reloadRequired,
			doneText: '[[admin/dashboard:restart-not-required]]',
			notDoneText: '[[admin/dashboard:restart-required]]',
		},
		{
			done: plugins.hooks.hasListeners('filter:search.query'),
			doneText: '[[admin/dashboard:search-plugin-installed]]',
			notDoneText: '[[admin/dashboard:search-plugin-not-installed]]',
			tooltip: '[[admin/dashboard:search-plugin-tooltip]]',
			link: '/admin/extend/plugins',
		},
	];

	if (global.env !== 'production') {
		notices.push({
			done: false,
			notDoneText: '[[admin/dashboard:running-in-development]]',
		});
	}

	return await plugins.hooks.fire('filter:admin.notices', notices);
}

async function getLatestVersion() {
	try {
		return await versions.getLatestVersion();
	} catch (err) {
		winston.error('[acp] Failed to fetch latest version', err.stack);
	}
	return null;
}

dashboardController.getAnalytics = async (req, res, next) => {
	// Basic validation
	const validUnits = ['days', 'hours'];
	const validSets = ['uniquevisitors', 'pageviews', 'pageviews:registered', 'pageviews:bot', 'pageviews:guest'];
	const until = req.query.until ? new Date(parseInt(req.query.until, 10)) : Date.now();
	const count = req.query.count || (req.query.units === 'hours' ? 24 : 30);
	if (isNaN(until) || !validUnits.includes(req.query.units)) {
		return next(new Error('[[error:invalid-data]]'));
	}

	// Filter out invalid sets, if no sets, assume all sets
	let sets;
	if (req.query.sets) {
		sets = Array.isArray(req.query.sets) ? req.query.sets : [req.query.sets];
		sets = sets.filter(set => validSets.includes(set));
	} else {
		sets = validSets;
	}

	const method = req.query.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
	let payload = await Promise.all(sets.map(set => method('analytics:' + set, until, count)));
	payload = _.zipObject(sets, payload);

	res.json({
		query: {
			set: req.query.set,
			units: req.query.units,
			until: until,
			count: count,
		},
		result: payload,
	});
};

async function getStats() {
	const cache = require('../../cache');
	const cachedStats = cache.get('admin:stats');
	if (cachedStats !== undefined) {
		return cachedStats;
	}

	const results = await Promise.all([
		getStatsForSet('ip:recent', 'uniqueIPCount'),
		getStatsForSet('users:joindate', 'userCount'),
		getStatsForSet('posts:pid', 'postCount'),
		getStatsForSet('topics:tid', 'topicCount'),
	]);
	results[0].name = '[[admin/dashboard:unique-visitors]]';
	results[1].name = '[[admin/dashboard:new-users]]';
	results[2].name = '[[admin/dashboard:posts]]';
	results[3].name = '[[admin/dashboard:topics]]';
	cache.set('admin:stats', results, 600000);
	return results;
}

async function getStatsForSet(set, field) {
	const terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
	};

	const now = Date.now();
	const results = await utils.promiseParallel({
		yesterday: db.sortedSetCount(set, now - (terms.day * 2), '+inf'),
		today: db.sortedSetCount(set, now - terms.day, '+inf'),
		lastweek: db.sortedSetCount(set, now - (terms.week * 2), '+inf'),
		thisweek: db.sortedSetCount(set, now - terms.week, '+inf'),
		lastmonth: db.sortedSetCount(set, now - (terms.month * 2), '+inf'),
		thismonth: db.sortedSetCount(set, now - terms.month, '+inf'),
		alltime: getGlobalField(field),
	});

	function textClass(num) {
		if (num > 0) {
			return 'text-success';
		} else if (num < 0) {
			return 'text-danger';
		}
		return 'text-warning';
	}

	function increasePercent(last, now) {
		const percent = last ? (now - last) / last * 100 : 0;
		return percent.toFixed(1);
	}
	results.yesterday -= results.today;
	results.dayIncrease = increasePercent(results.yesterday, results.today);
	results.dayTextClass = textClass(results.dayIncrease);

	results.lastweek -= results.thisweek;
	results.weekIncrease = increasePercent(results.lastweek, results.thisweek);
	results.weekTextClass = textClass(results.weekIncrease);

	results.lastmonth -= results.thismonth;
	results.monthIncrease = increasePercent(results.lastmonth, results.thismonth);
	results.monthTextClass = textClass(results.monthIncrease);

	return results;
}

async function getGlobalField(field) {
	const count = await db.getObjectField('global', field);
	return parseInt(count, 10) || 0;
}

async function getLastRestart() {
	const lastrestart = await db.getObject('lastrestart');
	if (!lastrestart) {
		return null;
	}
	const userData = await user.getUserData(lastrestart.uid);
	lastrestart.user = userData;
	lastrestart.timestampISO = utils.toISOString(lastrestart.timestamp);
	return lastrestart;
}
