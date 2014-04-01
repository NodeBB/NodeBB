'use strict';

var async = require('async'),
	db = require('./../database'),
	posts = require('./../posts'),
	user = require('./../user'),
	topics = require('./../topics'),
	categories = require('./../categories'),
	plugins = require('./../plugins'),
	events = require('./../events'),
	groups = require('./../groups');


module.exports = function(User) {

	User.delete = function(adminUid, uid, callback) {
		async.waterfall([
			function(next) {
				deletePosts(uid, next);
			},
			function(next) {
				deleteTopics(uid, next);
			},
			function(next) {
				events.logAdminUserDelete(adminUid, uid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			deleteAccount(uid, callback);
		});
	};

	function deletePosts(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':posts', deletePost, callback);
	}

	function deletePost(pid, callback) {
		async.parallel([
			function(next) {
				deletePostFromTopic(pid, next);
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
	}

	function deletePostFromTopic(pid, callback) {
		posts.getPostFields(pid, ['tid', 'deleted'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetRemove('tid:' + postData.tid + ':posts', pid, function(err) {
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

	function deleteTopics(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':topics', deleteTopic, callback);
	}

	function deleteSortedSetElements(set, deleteMethod, callback) {
		db.getSortedSetRange(set, 0, -1, function(err, ids) {
			if (err) {
				return callback(err);
			}

			async.each(ids, deleteMethod, callback);
		});
	}

	function deleteTopic(tid, callback) {

		async.parallel([
			function(next) {
				db.delete('tid:' + tid + ':followers', next);
			},
			function(next) {
				db.delete('tid:' + tid + ':read_by_uid', next);
			},
			function(next) {
				db.sortedSetRemove('topics:tid', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:recent', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:posts', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:views', tid, next);
			},
			function(next) {
				deleteTopicFromCategory(tid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:topic.delete', tid);
			db.delete('topic:' + tid, callback);
		});
	}

	function deleteTopicFromCategory(tid, callback) {
		topics.getTopicFields(tid, ['cid', 'deleted'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetRemove('categories:' + topicData.cid + ':tid', tid, function(err) {
				if (err) {
					return callback(err);
				}

				db.decrObjectField('category:' + topicData.cid, 'topic_count', function(err) {
					if (err) {
						return callback(err);
					}

					if (parseInt(topicData.deleted, 10) === 0) {
						db.decrObjectField('global', 'topicCount', callback);
					} else {
						callback();
					}
				});
			});
		});
	}

	function deleteAccount(uid, callback) {
		user.getUserFields(uid, ['username', 'userslug', 'email'], function(err, userData) {
			if (err)  {
				return callback(err);
			}

			async.parallel([
				function(next) {
					db.deleteObjectField('username:uid', userData.username, next);
				},
				function(next) {
					db.deleteObjectField('userslug:uid', userData.userslug, next);
				},
				function(next) {
					db.deleteObjectField('email:uid', userData.email, next);
				},
				function(next) {
					db.delete('uid:' + uid + ':notifications:read', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':notifications:unread', next);
				},
				function(next) {
					db.sortedSetRemove('users:joindate', uid, next);
				},
				function(next) {
					db.sortedSetRemove('users:postcount', uid, next);
				},
				function(next) {
					db.sortedSetRemove('users:reputation', uid, next);
				},
				function(next) {
					db.delete('uid:' + uid + ':favourites', next);
				},
				function(next) {
					db.delete('user:' + uid + ':settings', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':topics', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':posts', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':chats', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':ip', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':upvote', next);
				},
				function(next) {
					db.delete('uid:' + uid + ':downvote', next);
				},
				function(next) {
					deleteUserFromCategoryActiveUsers(uid, next);
				},
				function(next) {
					deleteUserFromFollowers(uid, next);
				},
				function(next) {
					groups.leaveAllGroups(uid, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.delete('followers:' + uid, next);
					},
					function(next) {
						db.delete('following:' + uid, next);
					},
					function(next) {
						db.delete('user:' + uid, next);
					},
					function(next) {
						db.decrObjectField('global', 'userCount', next);
					}
				], callback);
			});
		});
	}

	function deleteUserFromCategoryActiveUsers(uid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err) {
				return callback(err);
			}

			async.each(cids, function(cid, next) {
				categories.removeActiveUser(cid, uid, next);
			}, callback);
		});
	}

	function deleteUserFromFollowers(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, uids) {
			if (err) {
				return callback(err);
			}

			async.each(uids, function(theiruid, next) {
				db.setRemove('following:' + theiruid, uid, next);
			}, callback);
		});
	}
};
