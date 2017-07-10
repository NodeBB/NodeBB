
'use strict';

var async = require('async');

var db = require('../database');
var posts = require('../posts');

module.exports = function (Topics) {
	Topics.getUserBookmark = function (tid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, null);
		}
		db.sortedSetScore('tid:' + tid + ':bookmarks', uid, callback);
	};

	Topics.getUserBookmarks = function (tids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function () {
				return null;
			}));
		}
		db.sortedSetsScore(tids.map(function (tid) {
			return 'tid:' + tid + ':bookmarks';
		}), uid, callback);
	};

	Topics.setUserBookmark = function (tid, uid, index, callback) {
		db.sortedSetAdd('tid:' + tid + ':bookmarks', index, uid, callback);
	};

	Topics.getTopicBookmarks = function (tid, callback) {
		db.getSortedSetRangeWithScores(['tid:' + tid + ':bookmarks'], 0, -1, callback);
	};

	Topics.updateTopicBookmarks = function (tid, pids, callback) {
		var maxIndex;

		async.waterfall([
			function (next) {
				Topics.getPostCount(tid, next);
			},
			function (postcount, next) {
				maxIndex = postcount;
				Topics.getTopicBookmarks(tid, next);
			},
			function (bookmarks, next) {
				var forkedPosts = pids.map(function (pid) {
					return { pid: pid, tid: tid };
				});

				var uidData = bookmarks.map(function (bookmark) {
					return {
						uid: bookmark.value,
						bookmark: bookmark.score,
					};
				});

				async.eachLimit(uidData, 50, function (data, next) {
					posts.getPostIndices(forkedPosts, data.uid, function (err, postIndices) {
						if (err) {
							return next(err);
						}

						var bookmark = data.bookmark;
						bookmark = bookmark < maxIndex ? bookmark : maxIndex;

						for (var i = 0; i < postIndices.length && postIndices[i] < data.bookmark; i += 1) {
							bookmark -= 1;
						}

						if (parseInt(bookmark, 10) !== parseInt(data.bookmark, 10)) {
							Topics.setUserBookmark(tid, data.uid, bookmark, next);
						} else {
							next();
						}
					});
				}, next);
			},
		], function (err) {
			callback(err);
		});
	};
};
