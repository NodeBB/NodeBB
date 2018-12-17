'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.bookmark = function (pid, uid, callback) {
		toggleBookmark('bookmark', pid, uid, callback);
	};

	Posts.unbookmark = function (pid, uid, callback) {
		toggleBookmark('unbookmark', pid, uid, callback);
	};

	function toggleBookmark(type, pid, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		var isBookmarking = type === 'bookmark';
		var postData;
		var hasBookmarked;
		var owner;
		async.waterfall([
			function (next) {
				async.parallel({
					owner: function (next) {
						Posts.getPostField(pid, 'uid', next);
					},
					postData: function (next) {
						Posts.getPostFields(pid, ['pid', 'uid'], next);
					},
					hasBookmarked: function (next) {
						Posts.hasBookmarked(pid, uid, next);
					},
				}, next);
			},
			function (results, next) {
				owner = results.owner;
				postData = results.postData;
				hasBookmarked = results.hasBookmarked;

				if (isBookmarking && hasBookmarked) {
					return callback(new Error('[[error:already-bookmarked]]'));
				}

				if (!isBookmarking && !hasBookmarked) {
					return callback(new Error('[[error:already-unbookmarked]]'));
				}

				if (isBookmarking) {
					db.sortedSetAdd('uid:' + uid + ':bookmarks', Date.now(), pid, next);
				} else {
					db.sortedSetRemove('uid:' + uid + ':bookmarks', pid, next);
				}
			},
			function (next) {
				db[isBookmarking ? 'setAdd' : 'setRemove']('pid:' + pid + ':users_bookmarked', uid, next);
			},
			function (next) {
				db.setCount('pid:' + pid + ':users_bookmarked', next);
			},
			function (count, next) {
				postData.bookmarks = count;
				Posts.setPostField(pid, 'bookmarks', count, next);
			},
			function (next) {
				var current = hasBookmarked ? 'bookmarked' : 'unbookmarked';

				plugins.fireHook('action:post.' + type, {
					pid: pid,
					uid: uid,
					owner: owner,
					current: current,
				});

				next(null, {
					post: postData,
					isBookmarked: isBookmarking,
				});
			},
		], callback);
	}

	Posts.hasBookmarked = function (pid, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return callback(null, Array.isArray(pid) ? pid.map(() => false) : false);
		}

		if (Array.isArray(pid)) {
			var sets = pid.map(pid => 'pid:' + pid + ':users_bookmarked');
			db.isMemberOfSets(sets, uid, callback);
		} else {
			db.isSetMember('pid:' + pid + ':users_bookmarked', uid, callback);
		}
	};
};
