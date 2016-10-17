'use strict';

var async = require('async');
var _ = require('underscore');

var db = require('../database');
var topics = require('../topics');
var user = require('../user');
var plugins = require('../plugins');

module.exports = function (Posts) {

	Posts.delete = function (pid, uid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:post.delete', {pid: pid, uid: uid}, next);
			},
			function (data, next) {
				Posts.setPostField(pid, 'deleted', 1, next);
			},
			function (next) {
				Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'timestamp'], next);
			},
			function (_post, next) {
				postData = _post;
				topics.getTopicFields(_post.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				async.parallel([
					function (next) {
						updateTopicTimestamp(topicData, next);
					},
					function (next) {
						db.sortedSetRemove('cid:' + topicData.cid + ':pids', pid, next);
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					}
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:post.delete', pid);
				next(null, postData);
			}
		], callback);
	};

	Posts.restore = function (pid, uid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:post.restore', {pid: pid, uid: uid}, next);
			},
			function (data, next) {
				Posts.setPostField(pid, 'deleted', 0, next);
			},
			function (next) {
				Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp'], next);
			},
			function (_post, next) {
				postData = _post;
				topics.getTopicFields(_post.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				postData.cid = topicData.cid;
				async.parallel([
					function (next) {
						updateTopicTimestamp(topicData, next);
					},
					function (next) {
						db.sortedSetAdd('cid:' + topicData.cid + ':pids', postData.timestamp, pid, next);
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					}
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:post.restore', _.clone(postData));
				next(null, postData);
			}
		], callback);
	};

	function updateTopicTimestamp(topicData, callback) {
		var timestamp;
		async.waterfall([
			function (next) {
				topics.getLatestUndeletedPid(topicData.tid, next);
			},
			function (pid, next) {
				if (!parseInt(pid, 10)) {
					return callback();
				}
				Posts.getPostField(pid, 'timestamp', next);
			},
			function (_timestamp, next) {
				timestamp = _timestamp;
				if (!parseInt(timestamp, 10)) {
					return callback();
				}
				topics.updateTimestamp(topicData.tid, timestamp, next);
			},
			function (next) {
				if (parseInt(topicData.pinned, 10) !== 1) {
					db.sortedSetAdd('cid:' + topicData.cid + ':tids', timestamp, topicData.tid, next);
				} else {
					next();
				}
			}
		], callback);
	}

	Posts.purge = function (pid, uid, callback) {
		async.waterfall([
			function (next) {
				Posts.exists(pid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}
				plugins.fireHook('filter:post.purge', {pid: pid, uid: uid}, next);
			},
			function (data, next) {
				async.parallel([
					function (next) {
						deletePostFromTopicAndUser(pid, next);
					},
					function (next) {
						deletePostFromCategoryRecentPosts(pid, next);
					},
					function (next) {
						deletePostFromUsersBookmarks(pid, next);
					},
					function (next) {
						deletePostFromUsersVotes(pid, next);
					},
					function (next) {
						db.sortedSetsRemove(['posts:pid', 'posts:flagged'], pid, next);
					},
					function (next) {
						Posts.dismissFlag(pid, next);
					}
				], function (err) {
					if (err) {
						return next(err);
					}
					plugins.fireHook('action:post.purge', pid);
					db.delete('post:' + pid, next);
				});
			}
		], callback);
	};

	function deletePostFromTopicAndUser(pid, callback) {
		Posts.getPostFields(pid, ['tid', 'uid'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetsRemove([
				'tid:' + postData.tid + ':posts',
				'tid:' + postData.tid + ':posts:votes',
				'uid:' + postData.uid + ':posts'
			], pid, function (err) {
				if (err) {
					return callback(err);
				}

				topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned'], function (err, topicData) {
					if (err) {
						return callback(err);
					}

					async.parallel([
						function (next) {
							db.decrObjectField('global', 'postCount', next);
						},
						function (next) {
							db.decrObjectField('category:' + topicData.cid, 'post_count', next);
						},
						function (next) {
							topics.decreasePostCount(postData.tid, next);
						},
						function (next) {
							topics.updateTeaser(postData.tid, next);
						},
						function (next) {
							updateTopicTimestamp(topicData, next);
						},
						function (next) {
							db.sortedSetIncrBy('cid:' + topicData.cid + ':tids:posts', -1, postData.tid, next);
						},
						function (next) {
							db.sortedSetIncrBy('tid:' + postData.tid + ':posters', -1, postData.uid, next);
						},
						function (next) {
							user.incrementUserPostCountBy(postData.uid, -1, next);
						}
					], callback);
				});
			});
		});
	}

	function deletePostFromCategoryRecentPosts(pid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}

			var sets = cids.map(function (cid) {
				return 'cid:' + cid + ':pids';
			});

			db.sortedSetsRemove(sets, pid, callback);
		});
	}

	function deletePostFromUsersBookmarks(pid, callback) {
		db.getSetMembers('pid:' + pid + ':users_bookmarked', function (err, uids) {
			if (err) {
				return callback(err);
			}

			var sets = uids.map(function (uid) {
				return 'uid:' + uid + ':bookmarks';
			});

			db.sortedSetsRemove(sets, pid, function (err) {
				if (err) {
					return callback(err);
				}

				db.delete('pid:' + pid + ':users_bookmarked', callback);
			});
		});
	}

	function deletePostFromUsersVotes(pid, callback) {
		async.parallel({
			upvoters: function (next) {
				db.getSetMembers('pid:' + pid + ':upvote', next);
			},
			downvoters: function (next) {
				db.getSetMembers('pid:' + pid + ':downvote', next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			var upvoterSets = results.upvoters.map(function (uid) {
				return 'uid:' + uid + ':upvote';
			});

			var downvoterSets = results.downvoters.map(function (uid) {
				return 'uid:' + uid + ':downvote';
			});

			async.parallel([
				function (next) {
					db.sortedSetsRemove(upvoterSets, pid, next);
				},
				function (next) {
					db.sortedSetsRemove(downvoterSets, pid, next);
				},
				function (next) {
					db.deleteAll(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote'], next);
				}
			], callback);
		});
	}

};
