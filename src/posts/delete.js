'use strict';

var async = require('async'),
	db = require('../database'),
	topics = require('../topics'),
	plugins = require('../plugins');

module.exports = function(Posts) {

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
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:post.delete', pid);
			db.delete('post:' + pid, callback);
		});
	};

	function deletePostFromTopicAndUser(pid, callback) {
		Posts.getPostFields(pid, ['tid', 'uid', 'deleted'], function(err, postData) {
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

				topics.getTopicFields(postData.tid, ['cid', 'deleted'], function(err, topicData) {
					if (err) {
						return callback(err);
					}

					if (parseInt(postData.deleted, 10) === 0 && parseInt(topicData.deleted, 10) !== 1) {
						async.parallel([
							function (next) {
								db.decrObjectField('global', 'postCount', next);
							},
							function (next) {
								db.decrObjectField('category:' + topicData.cid, 'post_count', next);
							},
							function (next) {
								db.decrObjectField('topic:' + postData.tid, 'postcount', next);
							}
						], callback);
					} else {
						callback();
					}
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
