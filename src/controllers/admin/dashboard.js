'use strict';

var async = require('async');
var nconf = require('nconf');
var semver = require('semver');
var winston = require('winston');
const _ = require('lodash');

var versions = require('../../admin/versions');
var db = require('../../database');
var meta = require('../../meta');
const analytics = require('../../analytics').async;
var plugins = require('../../plugins');
var user = require('../../user');
var utils = require('../../utils');

var dashboardController = module.exports;

dashboardController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				stats: getStats,
				notices: function (next) {
					var notices = [
						{
							done: !meta.reloadRequired,
							doneText: '[[admin/general/dashboard:restart-not-required]]',
							notDoneText: '[[admin/general/dashboard:restart-required]]',
						},
						{
							done: plugins.hasListeners('filter:search.query'),
							doneText: '[[admin/general/dashboard:search-plugin-installed]]',
							notDoneText: '[[admin/general/dashboard:search-plugin-not-installed]]',
							tooltip: '[[admin/general/dashboard:search-plugin-tooltip]]',
							link: '/admin/extend/plugins',
						},
					];

					if (global.env !== 'production') {
						notices.push({
							done: false,
							notDoneText: '[[admin/general/dashboard:running-in-development]]',
						});
					}

					plugins.fireHook('filter:admin.notices', notices, next);
				},
				latestVersion: function (next) {
					versions.getLatestVersion(function (err, result) {
						if (err) {
							winston.error('[acp] Failed to fetch latest version', err);
						}

						next(null, err ? null : result);
					});
				},
				lastrestart: function (next) {
					getLastRestart(next);
				},
			}, next);
		},
		function (results) {
			var version = nconf.get('version');

			res.render('admin/general/dashboard', {
				version: version,
				lookupFailed: results.latestVersion === null,
				latestVersion: results.latestVersion,
				upgradeAvailable: results.latestVersion && semver.gt(results.latestVersion, version),
				currentPrerelease: versions.isPrerelease.test(version),
				notices: results.notices,
				stats: results.stats,
				canRestart: !!process.send,
				lastrestart: results.lastrestart,
			});
		},
	], next);
};

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
	let payload = await Promise.all(sets.map(async set => method('analytics:' + set, until, count)));
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

function getStats(callback) {
	async.waterfall([
		function (next) {
			async.parallel([
				function (next) {
					getStatsForSet('ip:recent', 'uniqueIPCount', next);
				},
				function (next) {
					getStatsForSet('users:joindate', 'userCount', next);
				},
				function (next) {
					getStatsForSet('posts:pid', 'postCount', next);
				},
				function (next) {
					getStatsForSet('topics:tid', 'topicCount', next);
				},
			], next);
		},
		function (results, next) {
			results[0].name = '[[admin/general/dashboard:unique-visitors]]';
			results[1].name = '[[admin/general/dashboard:users]]';
			results[2].name = '[[admin/general/dashboard:posts]]';
			results[3].name = '[[admin/general/dashboard:topics]]';

			next(null, results);
		},
	], callback);
}

function getStatsForSet(set, field, callback) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
	};

	var now = Date.now();
	async.parallel({
		day: function (next) {
			db.sortedSetCount(set, now - terms.day, '+inf', next);
		},
		week: function (next) {
			db.sortedSetCount(set, now - terms.week, '+inf', next);
		},
		month: function (next) {
			db.sortedSetCount(set, now - terms.month, '+inf', next);
		},
		alltime: function (next) {
			getGlobalField(field, next);
		},
	}, callback);
}

function getGlobalField(field, callback) {
	db.getObjectField('global', field, function (err, count) {
		callback(err, parseInt(count, 10) || 0);
	});
}

function getLastRestart(callback) {
	var lastrestart;
	async.waterfall([
		function (next) {
			db.getObject('lastrestart', next);
		},
		function (_lastrestart, next) {
			lastrestart = _lastrestart;
			if (!lastrestart) {
				return callback();
			}
			user.getUserData(lastrestart.uid, next);
		},
		function (userData, next) {
			lastrestart.user = userData;
			lastrestart.timestampISO = utils.toISOString(lastrestart.timestamp);
			next(null, lastrestart);
		},
	], callback);
}
