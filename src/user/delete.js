'use strict';

var async = require('async'),
	db = require('../database'),
	posts = require('../posts'),
	user = require('../user'),
	topics = require('../topics'),
	groups = require('../groups');


module.exports = function(User) {

	User.delete = function(uid, callback) {
		async.waterfall([
			function(next) {
				deletePosts(uid, next);
			},
			function(next) {
				deleteTopics(uid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			deleteAccount(uid, callback);
		});
	};

	function deletePosts(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':posts', posts.delete, callback);
	}

	function deleteTopics(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':topics', topics.delete, callback);
	}

	function deleteSortedSetElements(set, deleteMethod, callback) {
		db.getSortedSetRange(set, 0, -1, function(err, ids) {
			if (err) {
				return callback(err);
			}

			async.each(ids, deleteMethod, callback);
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
