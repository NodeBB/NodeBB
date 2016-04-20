'use strict';

var async = require('async');
var _ = require('underscore');

var db = require('../database');
var topics = require('../topics');
var user = require('../user');
var plugins = require('../plugins');

module.exports = function(Posts) {

	Posts.delete = function(pid, uid, callback) {
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
				topics.getTopicField(_post.tid, 'cid', next);
			},
			function (cid, next) {
				async.parallel([
					function(next) {
						updateTopicTimestamp(postData.tid, next);
					},
					function(next) {
						db.sortedSetRemove('cid:' + cid + ':pids', pid, next);
					},
					function(next) {
						Posts.dismissFlag(pid, next);
					},
					function(next) {
						topics.updateTeaser(postData.tid, next);
					}
				], function(err) {
					plugins.fireHook('action:post.delete', pid);
					next(err, postData);
				});
			}
		], callback);
	};

	Posts.restore = function(pid, uid, callback) {
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
				topics.getTopicField(_post.tid, 'cid', next);
			},
			function (cid, next) {
				postData.cid = cid;
				async.parallel([
					function(next) {
						updateTopicTimestamp(postData.tid, next);
					},
					function(next) {
						db.sortedSetAdd('cid:' + cid + ':pids', postData.timestamp, pid, next);
					},
					function(next) {
						topics.updateTeaser(postData.tid, next);
					}
				], function(err) {
					plugins.fireHook('action:post.restore', _.clone(postData));
					next(err, postData);
				});
			}
		], callback);
	};

	function updateTopicTimestamp(tid, callback) {
		topics.getLatestUndeletedPid(tid, function(err, pid) {
			if(err || !pid) {
				return callback(err);
			}

			Posts.getPostField(pid, 'timestamp', function(err, timestamp) {
				if (err) {
					return callback(err);
				}

				if (timestamp) {
					return topics.updateTimestamp(tid, timestamp, callback);
				}
				callback();
			});
		});
	}

	Posts.purge = function(pid, uid, callback) {
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
						deletePostFromUsersFavourites(pid, next);
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
				], function(err) {
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
		Posts.getPostFields(pid, ['tid', 'uid'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetsRemove([
				'tid:' + postData.tid + ':posts',
				'tid:' + postData.tid + ':posts:votes',
				'uid:' + postData.uid + ':posts'
			], pid, function(err) {
				if (err) {
					return callback(err);
				}

				topics.getTopicFields(postData.tid, ['cid'], function(err, topicData) {
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
						function(next) {
							topics.updateTeaser(postData.tid, next);
						},
						function(next) {
							db.sortedSetIncrBy('cid:' + topicData.cid + ':tids:posts', -1, postData.tid, next);
						},
						function(next) {
							db.sortedSetIncrBy('tid:' + postData.tid + ':posters', -1, postData.uid, next);
						},
						function(next) {
							user.incrementUserPostCountBy(postData.uid, -1, next);
						}
					], callback);
				});
			});
		});
	}

	function deletePostFromCategoryRecentPosts(pid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err) {
				return callback(err);
			}

			var sets = cids.map(function(cid) {
				return 'cid:' + cid + ':pids';
			});

			db.sortedSetsRemove(sets, pid, callback);
		});
	}

	function deletePostFromUsersFavourites(pid, callback) {
		db.getSetMembers('pid:' + pid + ':users_favourited', function(err, uids) {
			if (err) {
				return callback(err);
			}

			var sets = uids.map(function(uid) {
				return 'uid:' + uid + ':favourites';
			});

			db.sortedSetsRemove(sets, pid, function(err) {
				if (err) {
					return callback(err);
				}

				db.delete('pid:' + pid + ':users_favourited', callback);
			});
		});
	}

	function deletePostFromUsersVotes(pid, callback) {
		async.parallel({
			upvoters: function(next) {
				db.getSetMembers('pid:' + pid + ':upvote', next);
			},
			downvoters: function(next) {
				db.getSetMembers('pid:' + pid + ':downvote', next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var upvoterSets = results.upvoters.map(function(uid) {
				return 'uid:' + uid + ':upvote';
			});

			var downvoterSets = results.downvoters.map(function(uid) {
				return 'uid:' + uid + ':downvote';
			});

			async.parallel([
				function(next) {
					db.sortedSetsRemove(upvoterSets, pid, next);
				},
				function(next) {
					db.sortedSetsRemove(downvoterSets, pid, next);
				},
				function(next) {
					db.deleteAll(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote'], next);
				}
			], callback);
		});
	}

};
