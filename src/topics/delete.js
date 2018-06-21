'use strict';

var async = require('async');
var db = require('../database');

var user = require('../user');
var posts = require('../posts');
var plugins = require('../plugins');
var batch = require('../batch');


module.exports = function (Topics) {
	Topics.delete = function (tid, uid, callback) {
		async.parallel([
			function (next) {
				Topics.setTopicFields(tid, {
					deleted: 1,
					deleterUid: uid,
					deletedTimestamp: Date.now(),
				}, next);
			},
			function (next) {
				db.sortedSetsRemove([
					'topics:recent',
					'topics:posts',
					'topics:views',
					'topics:votes',
				], tid, next);
			},
			function (next) {
				async.waterfall([
					function (next) {
						async.parallel({
							cid: function (next) {
								Topics.getTopicField(tid, 'cid', next);
							},
							pids: function (next) {
								Topics.getPids(tid, next);
							},
						}, next);
					},
					function (results, next) {
						db.sortedSetRemove('cid:' + results.cid + ':pids', results.pids, next);
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	};

	Topics.restore = function (tid, uid, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				Topics.getTopicData(tid, next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				async.parallel([
					function (next) {
						Topics.setTopicField(tid, 'deleted', 0, next);
					},
					function (next) {
						Topics.deleteTopicFields(tid, ['deleterUid', 'deletedTimestamp'], next);
					},
					function (next) {
						Topics.updateRecent(tid, topicData.lastposttime, next);
					},
					function (next) {
						db.sortedSetAdd('topics:posts', topicData.postcount, tid, next);
					},
					function (next) {
						db.sortedSetAdd('topics:views', topicData.viewcount, tid, next);
					},
					function (next) {
						db.sortedSetAdd('topics:votes', parseInt(topicData.votes, 10) || 0, tid, next);
					},
					function (next) {
						async.waterfall([
							function (next) {
								Topics.getPids(tid, next);
							},
							function (pids, next) {
								posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted'], next);
							},
							function (postData, next) {
								postData = postData.filter(function (post) {
									return post && parseInt(post.deleted, 10) !== 1;
								});
								var pidsToAdd = [];
								var scores = [];
								postData.forEach(function (post) {
									pidsToAdd.push(post.pid);
									scores.push(post.timestamp);
								});
								db.sortedSetAdd('cid:' + topicData.cid + ':pids', scores, pidsToAdd, next);
							},
						], next);
					},
				], function (err) {
					next(err);
				});
			},
		], callback);
	};

	Topics.purgePostsAndTopic = function (tid, uid, callback) {
		var mainPid;
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			function (_mainPid, next) {
				mainPid = _mainPid;
				batch.processSortedSet('tid:' + tid + ':posts', function (pids, next) {
					async.eachSeries(pids, function (pid, next) {
						posts.purge(pid, uid, next);
					}, next);
				}, { alwaysStartAt: 0 }, next);
			},
			function (next) {
				posts.purge(mainPid, uid, next);
			},
			function (next) {
				Topics.purge(tid, uid, next);
			},
		], callback);
	};

	Topics.purge = function (tid, uid, callback) {
		var deletedTopic;
		async.waterfall([
			function (next) {
				async.parallel({
					topic: async.apply(Topics.getTopicData, tid),
					tags: async.apply(Topics.getTopicTags, tid),
				}, next);
			},
			function (results, next) {
				if (!results.topic) {
					return callback();
				}
				deletedTopic = results.topic;
				deletedTopic.tags = results.tags;
				deleteFromFollowersIgnorers(tid, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						db.deleteAll([
							'tid:' + tid + ':followers',
							'tid:' + tid + ':ignorers',
							'tid:' + tid + ':posts',
							'tid:' + tid + ':posts:votes',
							'tid:' + tid + ':bookmarks',
							'tid:' + tid + ':posters',
						], next);
					},
					function (next) {
						db.sortedSetsRemove([
							'topics:tid',
							'topics:recent',
							'topics:posts',
							'topics:views',
							'topics:votes',
						], tid, next);
					},
					function (next) {
						deleteTopicFromCategoryAndUser(tid, next);
					},
					function (next) {
						Topics.deleteTopicTags(tid, next);
					},
					function (next) {
						reduceCounters(tid, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				plugins.fireHook('action:topic.purge', { topic: deletedTopic, uid: uid });
				db.delete('topic:' + tid, next);
			},
		], callback);
	};

	function deleteFromFollowersIgnorers(tid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					followers: async.apply(db.getSetMembers, 'tid:' + tid + ':followers'),
					ignorers: async.apply(db.getSetMembers, 'tid:' + tid + ':ignorers'),
				}, next);
			},
			function (results, next) {
				var followerKeys = results.followers.map(function (uid) {
					return 'uid:' + uid + ':followed_tids';
				});
				var ignorerKeys = results.ignorers.map(function (uid) {
					return 'uid:' + uid + 'ignored_tids';
				});
				db.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid, next);
			},
		], callback);
	}

	function deleteTopicFromCategoryAndUser(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicFields(tid, ['cid', 'uid'], next);
			},
			function (topicData, next) {
				async.parallel([
					function (next) {
						db.sortedSetsRemove([
							'cid:' + topicData.cid + ':tids',
							'cid:' + topicData.cid + ':tids:pinned',
							'cid:' + topicData.cid + ':tids:posts',
							'cid:' + topicData.cid + ':tids:lastposttime',
							'cid:' + topicData.cid + ':tids:votes',
							'cid:' + topicData.cid + ':recent_tids',
							'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
							'uid:' + topicData.uid + ':topics',
						], tid, next);
					},
					function (next) {
						user.decrementUserFieldBy(topicData.uid, 'topiccount', 1, next);
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	function reduceCounters(tid, callback) {
		var incr = -1;
		async.parallel([
			function (next) {
				db.incrObjectFieldBy('global', 'topicCount', incr, next);
			},
			function (next) {
				async.waterfall([
					function (next) {
						Topics.getTopicFields(tid, ['cid', 'postcount'], next);
					},
					function (topicData, next) {
						topicData.postcount = parseInt(topicData.postcount, 10);
						topicData.postcount = topicData.postcount || 0;
						var postCountChange = incr * topicData.postcount;

						async.parallel([
							function (next) {
								db.incrObjectFieldBy('global', 'postCount', postCountChange, next);
							},
							function (next) {
								db.incrObjectFieldBy('category:' + topicData.cid, 'post_count', postCountChange, next);
							},
							function (next) {
								db.incrObjectFieldBy('category:' + topicData.cid, 'topic_count', incr, next);
							},
						], next);
					},
				], next);
			},
		], callback);
	}
};
