'use strict';

const nconf = require('nconf');
const semver = require('semver');
const winston = require('winston');
const _ = require('lodash');
const validator = require('validator');

const versions = require('../../admin/versions');
const db = require('../../database');
const meta = require('../../meta');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const user = require('../../user');
const topics = require('../../topics');
const utils = require('../../utils');
const emailer = require('../../emailer');

const dashboardController = module.exports;

dashboardController.get = async function (req, res) {
	const [stats, notices, latestVersion, lastrestart, isAdmin, popularSearches] = await Promise.all([
		getStats(),
		getNotices(),
		getLatestVersion(),
		getLastRestart(),
		user.isAdministrator(req.uid),
		getPopularSearches(),
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
		popularSearches: popularSearches,
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

	if (emailer.fallbackNotFound) {
		notices.push({
			done: false,
			notDoneText: '[[admin/dashboard:fallback-emailer-not-found]]',
		});
	}

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
		winston.error(`[acp] Failed to fetch latest version\n${err.stack}`);
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
	let payload = await Promise.all(sets.map(set => method(`analytics:${set}`, until, count)));
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

	let results = await Promise.all([
		getStatsFromAnalytics('uniquevisitors', 'uniqueIPCount'),
		getStatsFromAnalytics('logins', 'loginCount'),
		getStatsForSet('users:joindate', 'userCount'),
		getStatsForSet('posts:pid', 'postCount'),
		getStatsForSet('topics:tid', 'topicCount'),
	]);

	results[0].name = '[[admin/dashboard:unique-visitors]]';

	results[1].name = '[[admin/dashboard:logins]]';
	results[1].href = `${nconf.get('relative_path')}/admin/dashboard/logins`;

	results[2].name = '[[admin/dashboard:new-users]]';
	results[2].href = `${nconf.get('relative_path')}/admin/dashboard/users`;

	results[3].name = '[[admin/dashboard:posts]]';

	results[4].name = '[[admin/dashboard:topics]]';
	results[4].href = `${nconf.get('relative_path')}/admin/dashboard/topics`;

	({ results } = await plugins.hooks.fire('filter:admin.getStats', {
		results,
		helpers: { getStatsForSet, getStatsFromAnalytics },
	}));

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

	return calculateDeltas(results);
}

async function getStatsFromAnalytics(set, field) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const data = await analytics.getDailyStatsForSet(`analytics:${set}`, today, 60);
	const sum = arr => arr.reduce((memo, cur) => memo + cur, 0);
	const results = {
		yesterday: sum(data.slice(-2)),
		today: data.slice(-1)[0],
		lastweek: sum(data.slice(-14)),
		thisweek: sum(data.slice(-7)),
		lastmonth: sum(data.slice(0)), // entire set
		thismonth: sum(data.slice(-30)),
		alltime: await getGlobalField(field),
	};

	return calculateDeltas(results);
}

function calculateDeltas(results) {
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

async function getPopularSearches() {
	const searches = await db.getSortedSetRevRangeWithScores('searches:all', 0, 9);
	return searches.map(s => ({ value: validator.escape(String(s.value)), score: s.score }));
}

dashboardController.getLogins = async (req, res) => {
	let stats = await getStats();
	stats = stats.filter(stat => stat.name === '[[admin/dashboard:logins]]').map(({ ...stat }) => {
		delete stat.href;
		return stat;
	});
	const summary = {
		day: stats[0].today,
		week: stats[0].thisweek,
		month: stats[0].thismonth,
	};

	// List recent sessions
	const start = Date.now() - (1000 * 60 * 60 * 24 * meta.config.loginDays);
	const uids = await db.getSortedSetRangeByScore('users:online', 0, 500, start, Date.now());
	const usersData = await user.getUsersData(uids);
	let sessions = await Promise.all(uids.map(async (uid) => {
		const sessions = await user.auth.getSessions(uid);
		sessions.forEach((session) => {
			session.user = usersData[uids.indexOf(uid)];
		});

		return sessions;
	}));
	sessions = _.flatten(sessions).sort((a, b) => b.datetime - a.datetime);

	res.render('admin/dashboard/logins', {
		set: 'logins',
		query: req.query,
		stats,
		summary,
		sessions,
		loginDays: meta.config.loginDays,
	});
};

dashboardController.getUsers = async (req, res) => {
	let stats = await getStats();
	stats = stats.filter(stat => stat.name === '[[admin/dashboard:new-users]]').map(({ ...stat }) => {
		delete stat.href;
		return stat;
	});
	const summary = {
		day: stats[0].today,
		week: stats[0].thisweek,
		month: stats[0].thismonth,
	};

	// List of users registered within time frame
	const end = parseInt(req.query.until, 10) || Date.now();
	const start = end - (1000 * 60 * 60 * (req.query.units === 'days' ? 24 : 1) * (req.query.count || (req.query.units === 'days' ? 30 : 24)));
	const uids = await db.getSortedSetRangeByScore('users:joindate', 0, 500, start, end);
	const users = await user.getUsersData(uids);

	res.render('admin/dashboard/users', {
		set: 'registrations',
		query: req.query,
		stats,
		summary,
		users,
	});
};

dashboardController.getTopics = async (req, res) => {
	let stats = await getStats();
	stats = stats.filter(stat => stat.name === '[[admin/dashboard:topics]]').map(({ ...stat }) => {
		delete stat.href;
		return stat;
	});
	const summary = {
		day: stats[0].today,
		week: stats[0].thisweek,
		month: stats[0].thismonth,
	};

	// List of topics created within time frame
	const end = parseInt(req.query.until, 10) || Date.now();
	const start = end - (1000 * 60 * 60 * (req.query.units === 'days' ? 24 : 1) * (req.query.count || (req.query.units === 'days' ? 30 : 24)));
	const tids = await db.getSortedSetRangeByScore('topics:tid', 0, 500, start, end);
	const topicData = await topics.getTopicsByTids(tids);

	res.render('admin/dashboard/topics', {
		set: 'topics',
		query: req.query,
		stats,
		summary,
		topics: topicData,
	});
};

dashboardController.getSearches = async (req, res) => {
	let start = 0;
	let end = 0;
	if (req.query.start) {
		start = new Date(req.query.start);
		start.setHours(24, 0, 0, 0);
		end = new Date();
		end.setHours(24, 0, 0, 0);
	}
	if (req.query.end) {
		end = new Date(req.query.end);
		end.setHours(24, 0, 0, 0);
	}

	let searches;
	if (start && end && start <= end) {
		const daysArr = [start];
		const nextDay = new Date(start.getTime());
		while (nextDay < end) {
			nextDay.setDate(nextDay.getDate() + 1);
			nextDay.setHours(0, 0, 0, 0);
			daysArr.push(new Date(nextDay.getTime()));
		}

		const daysData = await Promise.all(
			daysArr.map(async d => db.getSortedSetRevRangeWithScores(`searches:${d.getTime()}`, 0, -1))
		);

		const map = {};
		daysData.forEach((d) => {
			d.forEach((search) => {
				if (!map[search.value]) {
					map[search.value] = search.score;
				} else {
					map[search.value] += search.score;
				}
			});
		});

		searches = Object.keys(map)
			.map(key => ({ value: key, score: map[key] }))
			.sort((a, b) => b.score - a.score);
	} else {
		searches = await db.getSortedSetRevRangeWithScores('searches:all', 0, 99);
	}

	res.render('admin/dashboard/searches', {
		searches: searches.map(s => ({ value: validator.escape(String(s.value)), score: s.score })),
		startDate: req.query.start ? validator.escape(String(req.query.start)) : null,
		endDate: req.query.end ? validator.escape(String(req.query.end)) : null,
	});
};
