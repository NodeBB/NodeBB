'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');

module.exports = function (Categories) {
	Categories.watchStates = {
		default: 0,
		ignoring: 1,
		notwatching: 2,
		watching: 3,
	};

	Categories.isIgnored = function (cids, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, cids.map(() => false));
		}

		const keys = cids.map(cid => 'cid:' + cid + ':uid:watch:state');
		async.waterfall([
			function (next) {
				async.parallel({
					userSettings: async.apply(user.getSettings, uid),
					states: async.apply(db.sortedSetsScore, keys, uid),
				}, next);
			},
			function (results, next) {
				cids = cids.map((cid, index) => {
					results.states[index] = results.states[index] || results.userSettings.categoryWatchState;
					return results.states[index] === Categories.watchStates.ignoring;
				});
				next(null, cids);
			},
		], callback);
	};

	Categories.getIgnorers = function (cid, start, stop, callback) {
		db.getSortedSetRevRangeByScore('cid:' + cid + ':uid:watch:state', start, stop - start + 1, Categories.watchStates.ignoring, Categories.watchStates.ignoring, callback);
	};

	Categories.filterIgnoringUids = function (cid, uids, callback) {
		async.waterfall([
			function (next) {
				// TODO:
				db.sortedSetScores('cid:' + cid + ':uid:watch:state', uids, next);
			},
			function (isIgnoring, next) {
				const readingUids = uids.filter((uid, index) => uid && !isIgnoring[index]);
				next(null, readingUids);
			},
		], callback);
	};
};
