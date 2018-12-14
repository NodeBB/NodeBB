'use strict';

const async = require('async');
const _ = require('lodash');

const db = require('../database');
const categories = require('../categories');

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

	User.getCategoryWatchState = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		let userSettings;
		let cids;
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
				db.sortedSetsScore(results.cids.map(cid => 'cid:' + cid + ':uid:watch:state'), uid, next);
			},
			function (states, next) {
				states = states.map(state => state || categories.watchStates[userSettings.categoryWatchState]);
				const data = _.zipObject(cids, states);
				next(null, data);
			},
		], callback);
	};

	User.getIgnoredCategories = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		User.getCategoriesByStates(uid, [categories.watchStates.ignoring], callback);
	};

	User.getWatchedCategories = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		User.getCategoriesByStates(uid, [categories.watchStates.watching], callback);
	};

	User.getCategoriesByStates = function (uid, states, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return categories.getAllCidsFromSet('categories:cid', callback);
		}
		let cids;
		let userSettings;
		states = states.map(Number);
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
			function (userState, next) {
				cids = cids.filter((cid, index) => {
					userState[index] = userState[index] || categories.watchStates[userSettings.categoryWatchState];
					return states.includes(userState[index]);
				});
				next(null, cids);
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
