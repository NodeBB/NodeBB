
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');
var privileges = require('../privileges');
var batch = require('../batch');

module.exports = function (Categories) {
	Categories.getRecentReplies = function (cid, uid, count, callback) {
		if (!parseInt(count, 10)) {
			return callback(null, []);
		}

		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('cid:' + cid + ':pids', 0, count - 1, next);
			},
			function (pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function (pids, next) {
				posts.getPostSummaryByPids(pids, uid, { stripTags: true }, next);
			},
		], callback);
	};

	Categories.updateRecentTid = function (cid, tid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					count: function (next) {
						db.sortedSetCard('cid:' + cid + ':recent_tids', next);
					},
					numRecentReplies: function (next) {
						db.getObjectField('category:' + cid, 'numRecentReplies', next);
					},
				}, next);
			},
			function (results, next) {
				if (results.count < results.numRecentReplies) {
					return db.sortedSetAdd('cid:' + cid + ':recent_tids', Date.now(), tid, callback);
				}
				db.getSortedSetRangeWithScores('cid:' + cid + ':recent_tids', 0, results.count - results.numRecentReplies, next);
			},
			function (data, next) {
				if (!data.length) {
					return next();
				}
				db.sortedSetsRemoveRangeByScore(['cid:' + cid + ':recent_tids'], '-inf', data[data.length - 1].score, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':recent_tids', Date.now(), tid, next);
			},
		], callback);
	};

	Categories.updateRecentTidForCid = function (cid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('cid:' + cid + ':pids', 0, 0, next);
			},
			function (pid, next) {
				pid = pid[0];
				posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				if (!parseInt(tid, 10)) {
					return next();
				}

				Categories.updateRecentTid(cid, tid, next);
			},
		], callback);
	};

	Categories.getRecentTopicReplies = function (categoryData, uid, callback) {
		if (!Array.isArray(categoryData) || !categoryData.length) {
			return callback();
		}

		async.waterfall([
			function (next) {
				var keys = categoryData.map(function (category) {
					return 'cid:' + category.cid + ':recent_tids';
				});
				db.getSortedSetsMembers(keys, next);
			},
			function (results, next) {
				var tids = _.uniq(_.flatten(results).filter(Boolean));

				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				getTopics(tids, uid, next);
			},
			function (topics, next) {
				assignTopicsToCategories(categoryData, topics);

				bubbleUpChildrenPosts(categoryData);

				next();
			},
		], callback);
	};

	function getTopics(tids, uid, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				topics.getTopicsFields(tids, ['tid', 'mainPid', 'slug', 'title', 'teaserPid', 'cid', 'postcount'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				topicData.forEach(function (topic) {
					if (topic) {
						topic.teaserPid = topic.teaserPid || topic.mainPid;
					}
				});
				var cids = _topicData.map(function (topic) {
					return topic && topic.cid;
				}).filter(function (cid, index, array) {
					return cid && array.indexOf(cid) === index;
				});

				async.parallel({
					categoryData: async.apply(Categories.getCategoriesFields, cids, ['cid', 'parentCid']),
					teasers: async.apply(topics.getTeasers, _topicData, uid),
				}, next);
			},
			function (results, next) {
				var parentCids = {};
				results.categoryData.forEach(function (category) {
					parentCids[category.cid] = category.parentCid;
				});
				results.teasers.forEach(function (teaser, index) {
					if (teaser) {
						teaser.cid = topicData[index].cid;
						teaser.parentCid = parseInt(parentCids[teaser.cid], 10) || 0;
						teaser.tid = undefined;
						teaser.uid = undefined;
						teaser.user.uid = undefined;
						teaser.topic = {
							slug: topicData[index].slug,
							title: topicData[index].title,
						};
					}
				});
				results.teasers = results.teasers.filter(Boolean);
				next(null, results.teasers);
			},
		], callback);
	}

	function assignTopicsToCategories(categories, topics) {
		categories.forEach(function (category) {
			category.posts = topics.filter(function (topic) {
				return topic.cid && (parseInt(topic.cid, 10) === parseInt(category.cid, 10) ||
					parseInt(topic.parentCid, 10) === parseInt(category.cid, 10));
			}).sort(function (a, b) {
				return b.pid - a.pid;
			}).slice(0, parseInt(category.numRecentReplies, 10));
		});
	}

	function bubbleUpChildrenPosts(categoryData) {
		categoryData.forEach(function (category) {
			if (category.posts.length) {
				return;
			}
			var posts = [];
			getPostsRecursive(category, posts);

			posts.sort(function (a, b) {
				return b.pid - a.pid;
			});
			if (posts.length) {
				category.posts = [posts[0]];
			}
		});
	}

	function getPostsRecursive(category, posts) {
		category.posts.forEach(function (p) {
			posts.push(p);
		});

		category.children.forEach(function (child) {
			getPostsRecursive(child, posts);
		});
	}

	Categories.moveRecentReplies = function (tid, oldCid, cid, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				updatePostCount(tid, oldCid, cid, next);
			},
			function (next) {
				topics.getPids(tid, next);
			},
			function (pids, next) {
				batch.processArray(pids, function (pids, next) {
					async.waterfall([
						function (next) {
							posts.getPostsFields(pids, ['timestamp'], next);
						},
						function (postData, next) {
							var timestamps = postData.map(function (post) {
								return post && post.timestamp;
							});

							async.parallel([
								function (next) {
									db.sortedSetRemove('cid:' + oldCid + ':pids', pids, next);
								},
								function (next) {
									db.sortedSetAdd('cid:' + cid + ':pids', timestamps, pids, next);
								},
							], next);
						},
					], next);
				}, next);
			},
		], callback);
	};

	function updatePostCount(tid, oldCid, newCid, callback) {
		async.waterfall([
			function (next) {
				topics.getTopicField(tid, 'postcount', next);
			},
			function (postCount, next) {
				if (!parseInt(postCount, 10)) {
					return callback();
				}
				async.parallel([
					function (next) {
						db.incrObjectFieldBy('category:' + oldCid, 'post_count', -postCount, next);
					},
					function (next) {
						db.incrObjectFieldBy('category:' + newCid, 'post_count', postCount, next);
					},
				], function (err) {
					next(err);
				});
			},
		], callback);
	}
};

