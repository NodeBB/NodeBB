'use strict';

var async = require('async'),
	db = require('../database'),
	topics = require('../topics'),
	user = require('../user'),
	plugins = require('../plugins');

module.exports = function(Posts) {

	Posts.delete = function(pid, callback) {
		Posts.setPostField(pid, 'deleted', 1, function(err) {
			if (err) {
				return callback(err);
			}

			Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'timestamp'], function(err, postData) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('action:post.delete', pid);

				async.parallel([
					function(next) {
						updateTopicTimestamp(postData.tid, next);
					},
					function(next) {
						removeFromCategoryRecentPosts(pid, postData.tid, next);
					}
				], function(err) {
					callback(err, postData);
				});
			});
		});
	};

	Posts.restore = function(pid, callback) {
		Posts.setPostField(pid, 'deleted', 0, function(err) {
			if (err) {
				return callback(err);
			}

			Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp'], function(err, postData) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('action:post.restore', postData);

				async.parallel([
					function(next) {
						updateTopicTimestamp(postData.tid, next);
					},
					function(next) {
						addToCategoryRecentPosts(pid, postData.tid, postData.timestamp, next);
					}
				], function(err) {
					callback(err, postData);
				});
			});
		});
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

	function removeFromCategoryRecentPosts(pid, tid, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			db.sortedSetRemove('categories:recent_posts:cid:' + cid, pid, callback);
		});
	}

	function addToCategoryRecentPosts(pid, tid, timestamp, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid, callback);
		});
	}

	Posts.purge = function(pid, callback) {
		async.parallel([
			function(next) {
				deletePostFromTopicAndUser(pid, next);
			},
			function(next) {
				deletePostFromCategoryRecentPosts(pid, next);
			},
			function(next) {
				deletePostFromUsersFavourites(pid, next);
			},
			function(next) {
				deletePostFromUsersVotes(pid, next);
			},
			function(next) {
				db.sortedSetRemove('posts:pid', pid, next);
			},
		], function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:post.delete', pid);
			db.delete('post:' + pid, callback);
		});
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
							user.incrementUserPostCountBy(postData.uid, -1, next);
						},
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
				return 'categories:recent_posts:cid:' + cid;
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
