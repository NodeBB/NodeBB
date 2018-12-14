'use strict';

const async = require('async');

const db = require('../database');
const user = require('../user');

module.exports = function (Categories) {
	Categories.watchStates = {
		ignoring: 1,
		notwatching: 2,
		watching: 3,
	};

	Categories.isIgnored = function (cids, uid, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback, null, cids.map(() => false));
		}
		async.waterfall([
			function (next) {
				Categories.getWatchState(cids, uid, next);
			},
			function (states, next) {
				next(null, states.map(state => state === Categories.watchStates.ignoring));
			},
		], callback);
	};

	Categories.getWatchState = function (cids, uid, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback, null, cids.map(() => Categories.watchStates.notwatching));
		}
		if (!Array.isArray(cids) || !cids.length) {
			return setImmediate(callback, null, []);
		}
		async.waterfall([
			function (next) {
				const keys = cids.map(cid => 'cid:' + cid + ':uid:watch:state');
				async.parallel({
					userSettings: async.apply(user.getSettings, uid),
					states: async.apply(db.sortedSetsScore, keys, uid),
				}, next);
			},
			function (results, next) {
				next(null, results.states.map(state => state || Categories.watchStates[results.userSettings.categoryWatchState]));
			},
		], callback);
	};

	Categories.getIgnorers = function (cid, start, stop, callback) {
		const count = (stop === -1) ? -1 : (stop - start + 1);
		db.getSortedSetRevRangeByScore('cid:' + cid + ':uid:watch:state', start, count, Categories.watchStates.ignoring, Categories.watchStates.ignoring, callback);
	};

	Categories.filterIgnoringUids = function (cid, uids, callback) {
		async.waterfall([
			function (next) {
				Categories.getUidsWatchStates(cid, uids, next);
			},
			function (states, next) {
				const readingUids = uids.filter((uid, index) => uid && states[index] !== Categories.watchStates.ignoring);
				next(null, readingUids);
			},
		], callback);
	};

	Categories.getUidsWatchStates = function (cid, uids, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					userSettings: async.apply(user.getMultipleUserSettings, uids),
					states: async.apply(db.sortedSetScores, 'cid:' + cid + ':uid:watch:state', uids),
				}, next);
			},
			function (results, next) {
				next(null, results.states.map((state, index) => state || Categories.watchStates[results.userSettings[index].categoryWatchState]));
			},
		], callback);
	};
};
