'use strict';

var async = require('async'),
	db = require('../database'),

	plugins = require('../plugins');


module.exports = function(Posts) {

	Posts.delete = function(pid, callback) {
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

			async.parallel([
				function(next) {
					db.sortedSetRemove('tid:' + postData.tid + ':posts', pid, next);
				},
				function(next) {
					db.sortedSetRemove('tid:' + postData.tid + ':posts:votes', pid, next);
				},
				function(next) {
					db.sortedSetRemove('uid:' + postData.uid + ':posts', pid, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				if (parseInt(postData.deleted, 10) === 0) {
					db.decrObjectField('global', 'postCount', callback);
				} else {
					callback();
				}
			});
		});
	}

	function deletePostFromCategoryRecentPosts(pid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err) {
				return callback(err);
			}

			async.each(cids, function(cid, next) {
				db.sortedSetRemove('categories:recent_posts:cid:' + cid, pid, next);
			}, callback);
		});
	}

	function deletePostFromUsersFavourites(pid, callback) {
		db.getSetMembers('pid:' + pid + ':users_favourited', function(err, uids) {
			if (err) {
				return callback(err);
			}

			async.each(uids, function(uid, next) {
				db.sortedSetRemove('uid:' + uid + ':favourites', pid, next);
			}, function(err) {
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

			async.parallel([
				function(next) {
					async.each(results.upvoters, function(uid, next) {
						db.sortedSetRemove('uid:' + uid + ':upvote', pid, next);
					}, next);
				},
				function(next) {
					async.each(results.downvoters, function(uid, next) {
						db.sortedSetRemove('uid:' + uid + ':downvote', pid, next);
					}, next);
				}
			], callback);
		});
	}


};