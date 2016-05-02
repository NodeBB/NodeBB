
'use strict';

var async = require('async');
var winston = require('winston');
var validator = require('validator');
var _ = require('underscore');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');
var privileges = require('../privileges');

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
			return callback();
		}

		async.waterfall([
			function(next) {
				async.map(categoryData, getRecentTopicTids, next);
			},
			function(results, next) {
				var tids = _.flatten(results);

				tids = tids.filter(function(tid, index, array) {
					return !!tid && array.indexOf(tid) === index;
				});
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function(tids, next) {
				getTopics(tids, next);
			},
			function(topics, next) {
				assignTopicsToCategories(categoryData, topics);

				bubbleUpChildrenPosts(categoryData);

				next();
			}
		], callback);
	};

	function getRecentTopicTids(category, callback) {
		var count = parseInt(category.numRecentReplies, 10);
		if (!count) {
			return callback(null, []);
		}

		if (count === 1) {
			async.waterfall([
				function (next) {
					db.getSortedSetRevRange('cid:' + category.cid + ':pids', 0, 0, next);
				},
				function (pid, next) {
					posts.getPostField(pid, 'tid', next);
				},
				function (tid, next) {
					next(null, [tid]);
				}
			], callback);
			return;
		}

		async.parallel({
			pinnedTids: function(next) {
				db.getSortedSetRevRangeByScore('cid:' + category.cid + ':tids', 0, -1, '+inf', Date.now(), next);
			},
			tids: function(next) {
				db.getSortedSetRevRangeByScore('cid:' + category.cid + ':tids', 0, Math.max(1, count), Date.now(), '-inf', next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			results.tids = results.tids.concat(results.pinnedTids);

			callback(null, results.tids);
		});
	}

	function getTopics(tids, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				topics.getTopicsFields(tids, ['tid', 'mainPid', 'slug', 'title', 'teaserPid', 'cid', 'postcount'], next);
			},
			function(_topicData, next) {
				topicData = _topicData;
				topics.getTeasers(_topicData, next);
			},
			function (teasers, next) {
				teasers.forEach(function(teaser, index) {
					if (teaser) {
						teaser.cid = topicData[index].cid;
						teaser.tid = teaser.uid = teaser.user.uid = undefined;
						teaser.topic = {
							slug: topicData[index].slug,
							title: validator.escape(topicData[index].title)
						};
					}
				});
				teasers = teasers.filter(Boolean);
				next(null, teasers);
			}
		], callback);
	}

	function assignTopicsToCategories(categories, topics) {
		categories.forEach(function(category) {
			category.posts = topics.filter(function(topic) {
				return topic.cid && parseInt(topic.cid, 10) === parseInt(category.cid, 10);
			}).sort(function(a, b) {
				return b.pid - a.pid;
			}).slice(0, parseInt(category.numRecentReplies, 10));
		});
	}

	function bubbleUpChildrenPosts(categoryData) {
		categoryData.forEach(function(category) {
			if (category.posts.length) {
				return;
			}
			var posts = [];
			getPostsRecursive(category, posts);

			posts.sort(function(a, b) {
				return b.pid - a.pid;
			});
			if (posts.length) {
				category.posts = [posts[0]];
			}
		});
	}

	function getPostsRecursive(category, posts) {
		category.posts.forEach(function(p) {
			posts.push(p);
		});

		category.children.forEach(function(child) {
			getPostsRecursive(child, posts);
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


