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
			return setImmediate(callback, null, {});
		}

		let cids;
		async.waterfall([
			function (next) {
				categories.getAllCidsFromSet('categories:cid', next);
			},
			function (_cids, next) {
				cids = _cids;
				categories.getWatchState(cids, uid, next);
			},
			function (states, next) {
				next(null, _.zipObject(cids, states));
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

		async.waterfall([
			function (next) {
				User.getCategoryWatchState(uid, next);
			},
			function (userState, next) {
				const cids = Object.keys(userState);
				next(null, cids.filter(cid => states.includes(userState[cid])));
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
