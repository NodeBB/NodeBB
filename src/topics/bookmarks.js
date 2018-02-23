
'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');

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
		db.getSortedSetRangeWithScores('tid:' + tid + ':bookmarks', 0, -1, callback);
	};

	Topics.updateTopicBookmarks = function (tid, pids, callback) {
		var minIndex;
		var maxIndex;
		var postIndices;

		async.waterfall([
			function (next) {
				Topics.getPostCount(tid, next);
			},
			function (postcount, next) {
				maxIndex = postcount;

				db.sortedSetRanks('tid:' + tid + ':posts', pids, next);
			},
			function (indices, next) {
				postIndices = indices.map(function (i) {
					return i === null ? 0 : i + 1;
				});
				minIndex = Math.min.apply(Math, postIndices);

				Topics.getTopicBookmarks(tid, next);
			},
			function (bookmarks, next) {
				var uidData = bookmarks.map(function (bookmark) {
					return {
						uid: bookmark.value,
						bookmark: parseInt(bookmark.score, 10),
					};
				}).filter(function (data) {
					return data.bookmark >= minIndex;
				});

				async.eachLimit(uidData, 50, function (data, next) {
					var bookmark = data.bookmark;
					bookmark = Math.min(bookmark, maxIndex);

					postIndices.forEach(function (i) {
						if (i < data.bookmark) {
							bookmark -= 1;
						}
					});

					// make sure the bookmark is valid if we removed the last post
					bookmark = Math.min(bookmark, maxIndex - pids.length);

					if (bookmark === data.bookmark) {
						return next();
					}

					user.getSettings(data.uid, function (err, settings) {
						if (err) {
							return next(err);
						}

						if (settings.topicPostSort === 'most_votes') {
							return next();
						}

						Topics.setUserBookmark(tid, data.uid, bookmark, next);
					});
				}, next);
			},
		], function (err) {
			callback(err);
		});
	};
};
