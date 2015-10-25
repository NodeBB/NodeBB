'use strict';

var async = require('async'),
	db = require('../database'),
	posts = require('../posts'),
	topics = require('../topics'),
	favourites = require('../favourites'),
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
				deleteVotes(uid, next);
			},
			function(next) {
				User.deleteAccount(uid, next);
			}
		], callback);
	};

	function deleteVotes(uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					upvotedPids: async.apply(db.getSortedSetRange, 'uid:' + uid + ':upvote', 0, -1),
					downvotedPids: async.apply(db.getSortedSetRange, 'uid:' + uid + ':downvote', 0, -1)
				}, next);
			},
			function (pids, next) {
				pids = pids.upvotedPids.concat(pids.downvotedPids).filter(function(pid, index, array) {
					return pid && array.indexOf(pid) === index;
				});

				async.eachLimit(pids, 50, function(pid, next) {
					favourites.unvote(pid, uid, next);
				}, next);
			}
		], callback);
	}

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

			plugins.fireHook('static:user.delete', {
				uid: uid
			}, function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.sortedSetRemove('username:uid', userData.username, next);
					},
					function(next) {
						db.sortedSetRemove('username:sorted', userData.username.toLowerCase() + ':' + uid, next);
					},
					function(next) {
						db.sortedSetRemove('userslug:uid', userData.userslug, next);
					},
					function(next) {
						db.sortedSetRemove('fullname:uid', userData.fullname, next);
					},
					function(next) {
						if (userData.email) {
							async.parallel([
								async.apply(db.sortedSetRemove, 'email:uid', userData.email.toLowerCase()),
								async.apply(db.sortedSetRemove, 'email:sorted', userData.email.toLowerCase() + ':' + uid)
							], next);
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
						db.decrObjectField('global', 'userCount', next);
					},
					function(next) {
						var keys = [
							'uid:' + uid + ':notifications:read', 'uid:' + uid + ':notifications:unread',
							'uid:' + uid + ':favourites', 'uid:' + uid + ':followed_tids', 'user:' + uid + ':settings',
							'uid:' + uid + ':topics', 'uid:' + uid + ':posts',
							'uid:' + uid + ':chats', 'uid:' + uid + ':chats:unread',
							'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
							'uid:' + uid + ':ignored:cids', 'uid:' + uid + ':flag:pids'
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
						// Deprecated as of v0.7.4, remove in v1.0.0
						plugins.fireHook('filter:user.delete', uid, next);
					}
				], function(err) {
					if (err) {
						return callback(err);
					}

					db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], callback);
				});
			});
		});
	};

	function deleteUserIps(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':ip', 0, -1, next);
			},
			function (ips, next) {
				var keys = ips.map(function(ip) {
					return 'ip:' + ip + ':uid';
				});
				db.sortedSetsRemove(keys, uid, next);
			},
			function (next) {
				db.delete('uid:' + uid + ':ip', next);
			}
		], callback);
	}

	function deleteUserFromFollowers(uid, callback) {
		async.parallel({
			followers: async.apply(db.getSortedSetRange, 'followers:' + uid, 0, -1),
			following: async.apply(db.getSortedSetRange, 'following:' + uid, 0, -1)
		}, function(err, results) {
			function updateCount(uids, name, fieldName, next) {
				async.each(uids, function(uid, next) {
					db.sortedSetCard(name + uid, function(err, count) {
						if (err) {
							return next(err);
						}
						count = parseInt(count, 10) || 0;
						db.setObjectField('user:' + uid, fieldName, count, next);
					});
				}, next);
			}

			if (err) {
				return callback(err);
			}

			var followingSets = results.followers.map(function(uid) {
				return 'following:' + uid;
			});

			var followerSets = results.following.map(function(uid) {
				return 'followers:' + uid;
			});

			async.parallel([
				async.apply(db.sortedSetsRemove, followerSets.concat(followingSets), uid),
				async.apply(updateCount, results.following, 'followers:', 'followerCount'),
				async.apply(updateCount, results.followers, 'following:', 'followingCount')
			], callback);
		});
	}
};
