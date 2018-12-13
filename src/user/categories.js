'use strict';

var async = require('async');

var db = require('../database');
var categories = require('../categories');

module.exports = function (User) {
	User.setCategoryWatchState = function (uid, cid, state, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback);
		}
		const isStateValid = Object.keys(categories.watchStates).some(key => categories.watchStates[key] === parseInt(state, 10));
		if (!isStateValid) {
			return setImmediate(callback, new Error('[[error:invalid-watch-state]]'));
		}
		async.waterfall([
			function (next) {
				categories.exists(cid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-category]]'));
				}

				db.sortedSetAdd('cid:' + cid + ':uid:watch:state', state, uid, next);
			},
		], callback);
	};

	User.getIgnoredCategories = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		let cids;
		let userSettings;
		async.waterfall([
			function (next) {
				async.parallel({
					userSettings: async.apply(User.getSettings, uid),
					cids: async.apply(categories.getAllCidsFromSet, 'categories:cid'),
				}, next);
			},
			function (results, next) {
				cids = results.cids;
				userSettings = results.userSettings;

				db.sortedSetsScore(cids.map(cid => 'cid:' + cid + ':uid:watch:state'), uid, next);
			},
			function (scores, next) {
				cids = cids.filter((cid, index) => {
					scores[index] = scores[index] || userSettings.categoryWatchState;
					return scores[index] === categories.watchStates.ignoring;
				});
				next(null, cids);
			},
		], callback);
	};

	User.getWatchedCategories = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					ignored: function (next) {
						User.getIgnoredCategories(uid, next);
					},
					all: function (next) {
						categories.getAllCidsFromSet('categories:cid', next);
					},
				}, next);
			},
			function (results, next) {
				const ignored = new Set(results.ignored);
				const watched = results.all.filter(cid => cid && !ignored.has(String(cid)));
				next(null, watched);
			},
		], callback);
	};

	User.ignoreCategory = function (uid, cid, callback) {
		User.setCategoryWatchState(uid, cid, categories.watchStates.ignoring, callback);
	};

	User.watchCategory = function (uid, cid, callback) {
		User.setCategoryWatchState(uid, cid, categories.watchStates.watching, callback);
	};
};
