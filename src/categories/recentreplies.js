
'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),

	db = require('../database'),
	posts = require('../posts'),
	topics = require('../topics'),
	privileges = require('../privileges'),
	plugins = require('../plugins');

module.exports = function(Categories) {
	Categories.getRecentReplies = function(cid, uid, count, callback) {
		if (!parseInt(count, 10)) {
			return callback(null, []);
		}

		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('cid:' + cid + ':pids', 0, count - 1, next);
			},
			function(pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function(pids, next) {
				posts.getPostSummaryByPids(pids, uid, {stripTags: true}, next);
			}
		], callback);
	};

	Categories.getRecentTopicReplies = function(categoryData, uid, callback) {
		if (!Array.isArray(categoryData) || !categoryData.length) {
			return callback(null, []);
		}

		async.waterfall([
			function(next) {
				async.map(categoryData, getRecentTopicPids, next);
			},
			function(results, next) {
				var pids = _.flatten(results);

				pids = pids.filter(function(pid, index, array) {
					return !!pid && array.indexOf(pid) === index;
				});
				privileges.posts.filter('read', pids, uid, next);
			},
			function(pids, next) {
				posts.getPostSummaryByPids(pids, uid, {stripTags: true}, next);
			},
			function(posts, next) {
				categoryData.forEach(function(category) {
					assignPostsToCategory(category, posts);
				});
				next();
			}
		], callback);
	};

	function assignPostsToCategory(category, posts) {
		category.posts = posts.filter(function(post) {
			return post.category && (parseInt(post.category.cid, 10) === parseInt(category.cid, 10)
				|| parseInt(post.category.parentCid, 10) === parseInt(category.cid, 10));
		}).sort(function(a, b) {
			return b.timestamp - a.timestamp;
		}).slice(0, parseInt(category.numRecentReplies, 10));
	}

	function getRecentTopicPids(category, callback) {
		var count = parseInt(category.numRecentReplies, 10);
		if (!count) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('cid:' + category.cid + ':pids', 0, 0, function(err, pids) {
			if (err || !Array.isArray(pids) || !pids.length) {
				return callback(err, []);
			}

			if (count === 1) {
				return callback(null, pids);
			}

			async.parallel({
				pinnedTids: function(next) {
					db.getSortedSetRevRangeByScore('cid:' + category.cid + ':tids', 0, -1, '+inf', Date.now(), next);
				},
				tids: function(next) {
					db.getSortedSetRevRangeByScore('cid:' + category.cid + ':tids', 0, Math.max(0, count), Date.now(), 0, next);
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
					}).sort(function(a, b) {
						return b - a;
					}).slice(0, count);

					callback(null, pids);
				});
			});
		});
	}


	Categories.moveRecentReplies = function(tid, oldCid, cid) {
		updatePostCount(tid, oldCid, cid);
		topics.getPids(tid, function(err, pids) {
			if (err) {
				return winston.error(err.message);
			}

			if (!Array.isArray(pids) || !pids.length) {
				return;
			}

			var start = 0,
				done = false,
				batch = 50;

			async.whilst(function() {
				return !done;
			}, function(next) {
				var movePids = pids.slice(start, start + batch);
				if (!movePids.length) {
					done = true;
					return next();
				}

				posts.getPostsFields(movePids, ['timestamp'], function(err, postData) {
					if (err) {
						return next(err);
					}

					var timestamps = postData.map(function(post) {
						return post && post.timestamp;
					});

					async.parallel([
						function(next) {
							db.sortedSetRemove('cid:' + oldCid + ':pids', movePids, next);
						},
						function(next) {
							db.sortedSetAdd('cid:' + cid + ':pids', timestamps, movePids, next);
						}
					], function(err) {
						if (err) {
							return next(err);
						}
						start += batch;
						next();
					});
				});
			}, function(err) {
				if (err) {
					winston.error(err.stack);
				}
			});
		});
	};

	function updatePostCount(tid, oldCid, newCid) {
		topics.getTopicField(tid, 'postcount', function(err, postCount) {
			if (err) {
				return winston.error(err.message);
			}
			if (!parseInt(postCount, 10)) {
				return;
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


