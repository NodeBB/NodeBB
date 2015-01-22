'use strict';

var async = require('async'),
	db = require('../database'),
	posts = require('../posts'),
	topics = require('../topics'),
	groups = require('../groups'),
	plugins = require('../plugins'),
	batch = require('../batch');

module.exports = function(User) {

	User.delete = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:invalid-uid]]'));
		}
		async.waterfall([
			function(next) {
				deletePosts(uid, next);
			},
			function(next) {
				deleteTopics(uid, next);
			},
			function(next) {
				User.deleteAccount(uid, next);
			}
		], callback);
	};

	function deletePosts(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':posts', posts.purge, callback);
	}

	function deleteTopics(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':topics', topics.purge, callback);
	}

	function deleteSortedSetElements(set, deleteMethod, callback) {
		batch.processSortedSet(set, function(ids, next) {
			async.eachLimit(ids, 10, deleteMethod, next);
		}, {alwaysStartAt: 0}, callback);
	}

	User.deleteAccount = function(uid, callback) {
		User.getUserFields(uid, ['username', 'userslug', 'fullname', 'email'], function(err, userData) {
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
					db.deleteObjectField('fullname:uid', userData.fullname, next);
				},
				function(next) {
					if (userData.email) {
						db.deleteObjectField('email:uid', userData.email.toLowerCase(), next);
					} else {
						next();
					}
				},
				function(next) {
					db.sortedSetsRemove([
						'users:joindate',
						'users:postcount',
						'users:reputation',
						'users:banned',
						'users:online'
					], uid, next);
				},
				function(next) {
					var keys = [
						'uid:' + uid + ':notifications:read', 'uid:' + uid + ':notifications:unread',
						'uid:' + uid + ':favourites', 'uid:' + uid + ':followed_tids', 'user:' + uid + ':settings',
						'uid:' + uid + ':topics', 'uid:' + uid + ':posts',
						'uid:' + uid + ':chats', 'uid:' + uid + ':chats:unread',
						'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
						'uid:' + uid + ':ignored:cids'
					];
					db.deleteAll(keys, next);
				},
				function(next) {
					deleteUserIps(uid, next);
				},
				function(next) {
					deleteUserFromFollowers(uid, next);
				},
				function(next) {
					groups.leaveAllGroups(uid, next);
				},
				function(next) {
					plugins.fireHook('filter:user.delete', uid, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], next);
					},
					function(next) {
						db.decrObjectField('global', 'userCount', next);
					}
				], callback);
			});
		});
	};

	function deleteUserIps(uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':ip', 0, -1, function(err, ips) {
			if (err) {
				return callback(err);
			}

			async.each(ips, function(ip, next) {
				db.sortedSetRemove('ip:' + ip + ':uid', uid, next);
			}, function(err) {
				if (err) {
					return callback(err);
				}
				db.delete('uid:' + uid + ':ip', callback);
			});
		})
	}

	function deleteUserFromFollowers(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, uids) {
			if (err) {
				return callback(err);
			}

			var sets = uids.map(function(uid) {
				return 'following:' + uid;
			});

			db.setsRemove(sets, uid, callback);
		});
	}
};
