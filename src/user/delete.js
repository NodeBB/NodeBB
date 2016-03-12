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

	User.delete = function(callerUid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:invalid-uid]]'));
		}
		async.waterfall([
			function(next) {
				deletePosts(callerUid, uid, next);
			},
			function(next) {
				deleteTopics(callerUid, uid, next);
			},
			function(next) {
				User.deleteAccount(uid, next);
			}
		], callback);
	};

	function deletePosts(callerUid, uid, callback) {
		batch.processSortedSet('uid:' + uid + ':posts', function(ids, next) {
			async.eachSeries(ids, function(pid, netx) {
				posts.purge(pid, callerUid, next);
			}, next);
		}, {alwaysStartAt: 0}, callback);
	}

	function deleteTopics(callerUid, uid, callback) {
		batch.processSortedSet('uid:' + uid + ':topics', function(ids, next) {
			async.eachSeries(ids, function(tid, next) {
				topics.purge(tid, callerUid, next);
			}, next);
		}, {alwaysStartAt: 0}, callback);
	}

	User.deleteAccount = function(uid, callback) {
		var userData;
		async.waterfall([
			function (next) {
				User.getUserFields(uid, ['username', 'userslug', 'fullname', 'email'], next);
			},
			function (_userData, next)  {
				userData = _userData;
				plugins.fireHook('static:user.delete', {uid: uid}, next);
			},
			function (next) {
				deleteVotes(uid, next);
			},
			function (next) {
				deleteChats(uid, next);
			},
			function (next) {
				User.auth.revokeAllSessions(uid, next);
			},
			function (next) {
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
							'users:online',
							'users:notvalidated'
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
							'uid:' + uid + ':chat:rooms', 'uid:' + uid + ':chat:rooms:unread',
							'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
							'uid:' + uid + ':ignored:cids', 'uid:' + uid + ':flag:pids',
							'uid:' + uid + ':sessions', 'uid:' + uid + ':sessionUUID:sessionId'
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
				], next);
			},
			function (results, next) {
				db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], next);
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

				async.eachSeries(pids, function(pid, next) {
					favourites.unvote(pid, uid, next);
				}, next);
			}
		], function(err) {
			callback(err);
		});
	}

	function deleteChats(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':chat:rooms', 0, -1, next);
			},
			function (roomIds, next) {
				var userKeys = roomIds.map(function(roomId) {
					return 'uid:' + uid + ':chat:room:' + roomId + ':mids';
				});
				var roomKeys = roomIds.map(function(roomId) {
					return 'chat:room:' + roomId + ':uids';
				});

				async.parallel([
					async.apply(db.sortedSetsRemove, roomKeys, uid),
					async.apply(db.deleteAll, userKeys)
				], next);
			}
		], function(err) {
			callback(err);
		});
	}

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
