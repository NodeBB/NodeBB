'use strict';

var async = require('async');

var db = require('../database');
var categories = require('../categories');

module.exports = function (User) {
	User.getIgnoredCategories = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		db.getSortedSetRange('uid:' + uid + ':ignored:cids', 0, -1, callback);
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
		if (uid <= 0) {
			return setImmediate(callback);
		}

		async.waterfall([
			function (next) {
				categories.exists(cid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-category]]'));
				}
				db.sortedSetAdd('uid:' + uid + ':ignored:cids', Date.now(), cid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':ignorers', Date.now(), uid, next);
			},
		], callback);
	};

	User.watchCategory = function (uid, cid, callback) {
		if (uid <= 0) {
			return callback();
		}

		async.waterfall([
			function (next) {
				categories.exists(cid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-category]]'));
				}
				db.sortedSetRemove('uid:' + uid + ':ignored:cids', cid, next);
			},
			function (next) {
				db.sortedSetRemove('cid:' + cid + ':ignorers', uid, next);
			},
		], callback);
	};
};
