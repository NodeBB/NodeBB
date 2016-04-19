'use strict';

var async = require('async');
var db = require('../database');

var user = require('../user');
var posts = require('../posts');
var plugins = require('../plugins');
var batch = require('../batch');


module.exports = function(Topics) {

	Topics.delete = function(tid, uid, callback) {
		Topics.getTopicFields(tid, ['cid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					Topics.setTopicField(tid, 'deleted', 1, next);
				},
				function(next) {
					db.sortedSetsRemove(['topics:recent', 'topics:posts', 'topics:views'], tid, next);
				},
				function(next) {
					Topics.getPids(tid, function(err, pids) {
						if (err) {
							return next(err);
						}
						db.sortedSetRemove('cid:' + topicData.cid + ':pids', pids, next);
					});
				}
			], function(err, results) {
				callback(err);
			});
		});
	};

	Topics.restore = function(tid, uid, callback) {
		Topics.getTopicFields(tid, ['cid', 'lastposttime', 'postcount', 'viewcount'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					Topics.setTopicField(tid, 'deleted', 0, next);
				},
				function(next) {
					Topics.updateRecent(tid, topicData.lastposttime, next);
				},
				function(next) {
					db.sortedSetAdd('topics:posts', topicData.postcount, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:views', topicData.viewcount, tid, next);
				},
				function(next) {
					Topics.getPids(tid, function(err, pids) {
						if (err) {
							return callback(err);
						}

						posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted'], function(err, postData) {
							if (err) {
								return next(err);
							}
							postData = postData.filter(function(post) {
								return post && parseInt(post.deleted, 10) !== 1;
							});
							var pidsToAdd = [], scores = [];
							postData.forEach(function(post) {
								pidsToAdd.push(post.pid);
								scores.push(post.timestamp);
							});
							db.sortedSetAdd('cid:' + topicData.cid + ':pids', scores, pidsToAdd, next);
						});
					});
				}
			], function(err, results) {
				callback(err);
			});
		});
	};

	Topics.purgePostsAndTopic = function(tid, uid, callback) {
		var mainPid;
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			function (_mainPid, next) {
				mainPid = _mainPid;
				batch.processSortedSet('tid:' + tid + ':posts', function(pids, next) {
					async.eachLimit(pids, 10, function(pid, next) {
						posts.purge(pid, uid, next);
					}, next);
				}, {alwaysStartAt: 0}, next);
			},
			function (next) {
				posts.purge(mainPid, uid, next);
			},
			function (next) {
				Topics.purge(tid, uid, next);
			}
		], callback);
	};

	Topics.purge = function(tid, uid, callback) {
		async.parallel([
			function(next) {
				db.deleteAll([
					'tid:' + tid + ':followers',
					'tid:' + tid + ':posts',
					'tid:' + tid + ':posts:votes',
					'tid:' + tid + ':bookmarks',
					'tid:' + tid + ':posters'
				], next);
			},
			function(next) {
				db.sortedSetsRemove(['topics:tid', 'topics:recent', 'topics:posts', 'topics:views'], tid, next);
			},
			function(next) {
				deleteTopicFromCategoryAndUser(tid, next);
			},
			function(next) {
				Topics.deleteTopicTags(tid, next);
			},
			function(next) {
				reduceCounters(tid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:topic.purge', tid);
			db.delete('topic:' + tid, callback);
		});
	};

	function deleteTopicFromCategoryAndUser(tid, callback) {
		Topics.getTopicFields(tid, ['cid', 'uid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}
			async.parallel([
				function(next) {
					db.sortedSetsRemove([
						'cid:' + topicData.cid + ':tids',
						'cid:' + topicData.cid + ':tids:posts',
						'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
						'uid:' + topicData.uid + ':topics'
					], tid, next);
				},
				function(next) {
					user.decrementUserFieldBy(topicData.uid, 'topiccount', 1, next);
				}
			], callback);
		});
	}

	function reduceCounters(tid, callback) {
		var incr = -1;
		async.parallel([
			function(next) {
				db.incrObjectFieldBy('global', 'topicCount', incr, next);
			},
			function(next) {
				Topics.getTopicFields(tid, ['cid', 'postcount'], function(err, topicData) {
					if (err) {
						return next(err);
					}
					topicData.postcount = parseInt(topicData.postcount, 10);
					topicData.postcount = topicData.postcount || 0;
					var postCountChange = incr * topicData.postcount;

					async.parallel([
						function(next) {
							db.incrObjectFieldBy('global', 'postCount', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + topicData.cid, 'post_count', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + topicData.cid, 'topic_count', incr, next);
						}
					], next);
				});
			}
		], callback);
	}
};
