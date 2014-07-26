
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	posts = require('../posts'),
	topics = require('../topics');

module.exports = function(Categories) {
	Categories.getRecentReplies = function(cid, uid, count, callback) {
		if (!parseInt(count, 10)) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, count - 1, function(err, pids) {
			if (err || !pids || !pids.length) {
				return callback(err, []);
			}

			posts.getPostSummaryByPids(pids, {stripTags: true}, callback);
		});
	};

	Categories.getRecentTopicReplies = function(cid, uid, count, callback) {
		count = parseInt(count, 10);
		if (!count) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, 0, function(err, pids) {
			if (err || !pids || !pids.length) {
				return callback(err, []);
			}

			if (count === 1) {
				return posts.getPostSummaryByPids(pids, {stripTags: true}, callback);
			}

			async.parallel({
				pinnedTids: function(next) {
					db.getSortedSetRevRangeByScore('categories:' + cid + ':tid', 0, -1, Infinity, Date.now(), next);
				},
				tids: function(next) {
					db.getSortedSetRevRangeByScore('categories:' + cid + ':tid', 0, Math.max(0, count), Date.now(), 0, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.tids = results.tids.concat(results.pinnedTids);

				async.map(results.tids, topics.getLatestUndeletedPid, function(err, topicPids) {
					if (err) {
						return callback(err);
					}

					pids = pids.concat(topicPids).filter(function(pid, index, array) {
						return !!pid && array.indexOf(pid) === index;
					});

					posts.getPostSummaryByPids(pids, {stripTags: true}, function(err, posts) {
						if (err) {
							return callback(err);
						}

						posts = posts.sort(function(a, b) {
							return parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10);
						}).slice(0, count);

						callback(err, posts);
					});
				});
			});
		});
	};

	Categories.moveRecentReplies = function(tid, oldCid, cid) {
		function movePost(postData, next) {
			async.parallel([
				function(next) {
					db.sortedSetRemove('categories:recent_posts:cid:' + oldCid, postData.pid, next);
				},
				function(next) {
					db.sortedSetAdd('categories:recent_posts:cid:' + cid, postData.timestamp, postData.pid, next);
				}
			], next);
		}

		updatePostCount(tid, oldCid, cid);
		topics.getPids(tid, function(err, pids) {
			if (err) {
				return winston.error(err.message);
			}

			if (pids && !pids.length) {
				return;
			}

			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['pid', 'timestamp'], function(err, postData) {
				if (err) {
					return winston.error(err.message);
				}

				async.each(postData, movePost, function(err) {
					if (err) {
						winston.error(err.message);
					}
				});
			});
		});
	};

	function updatePostCount(tid, oldCid, newCid) {
		topics.getTopicField(tid, 'postcount', function(err, postCount) {
			if (err) {
				return winston.error(err.message);
			}

			async.parallel([
				function(next) {
					db.incrObjectFieldBy('category:' + oldCid, 'post_count', -postCount, next);
				},
				function(next) {
					db.incrObjectFieldBy('category:' + newCid, 'post_count', postCount, next);
				}
			], function(err) {
				if (err) {
					winston.error(err.message);
				}
			});
		});
	}
};


