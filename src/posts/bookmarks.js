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
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		var isBookmarking = type === 'bookmark';

		async.parallel({
			owner: function (next) {
				Posts.getPostField(pid, 'uid', next);
			},
			postData: function (next) {
				Posts.getPostFields(pid, ['pid', 'uid'], next);
			},
			hasBookmarked: function (next) {
				Posts.hasBookmarked(pid, uid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			if (isBookmarking && results.hasBookmarked) {
				return callback(new Error('[[error:already-bookmarked]]'));
			}

			if (!isBookmarking && !results.hasBookmarked) {
				return callback(new Error('[[error:already-unbookmarked]]'));
			}

			async.waterfall([
				function (next) {
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
					results.postData.bookmarks = count;
					Posts.setPostField(pid, 'bookmarks', count, next);
				}
			], function (err) {
				if (err) {
					return callback(err);
				}

				var current = results.hasBookmarked ? 'bookmarked' : 'unbookmarked';

				plugins.fireHook('action:post.' + type, {
					pid: pid,
					uid: uid,
					owner: results.owner,
					current: current
				});

				callback(null, {
					post: results.postData,
					isBookmarked: isBookmarking
				});
			});
		});
	}

	Posts.hasBookmarked = function (pid, uid, callback) {
		if (!parseInt(uid, 10)) {
			if (Array.isArray(pid)) {
				callback(null, pid.map(function () { return false; }));
			} else {
				callback(null, false);
			}
			return;
		}

		if (Array.isArray(pid)) {
			var sets = pid.map(function (pid) {
				return 'pid:' + pid + ':users_bookmarked';
			});

			db.isMemberOfSets(sets, uid, callback);
		} else {
			db.isSetMember('pid:' + pid + ':users_bookmarked', uid, callback);
		}
	};
};
