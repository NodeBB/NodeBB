'use strict';

var async = require('async');
var _ = require('lodash');
var path = require('path');
var nconf = require('nconf');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');
var groups = require('../groups');
var messaging = require('../messaging');
var plugins = require('../plugins');
var batch = require('../batch');
var file = require('../file');

module.exports = function (User) {
	var deletesInProgress = {};

	User.delete = function (callerUid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return setImmediate(callback, new Error('[[error:invalid-uid]]'));
		}
		if (deletesInProgress[uid]) {
			return setImmediate(callback, new Error('[[error:already-deleting]]'));
		}
		deletesInProgress[uid] = 'user.delete';
		async.waterfall([
			function (next) {
				removeFromSortedSets(uid, next);
			},
			function (next) {
				deletePosts(callerUid, uid, next);
			},
			function (next) {
				deleteTopics(callerUid, uid, next);
			},
			function (next) {
				deleteUploads(uid, next);
			},
			function (next) {
				User.deleteAccount(uid, next);
			},
		], callback);
	};

	function deletePosts(callerUid, uid, callback) {
		batch.processSortedSet('uid:' + uid + ':posts', function (ids, next) {
			async.eachSeries(ids, function (pid, next) {
				posts.purge(pid, callerUid, next);
			}, next);
		}, { alwaysStartAt: 0 }, callback);
	}

	function deleteTopics(callerUid, uid, callback) {
		batch.processSortedSet('uid:' + uid + ':topics', function (ids, next) {
			async.eachSeries(ids, function (tid, next) {
				topics.purge(tid, callerUid, next);
			}, next);
		}, { alwaysStartAt: 0 }, callback);
	}

	function deleteUploads(uid, callback) {
		batch.processSortedSet('uid:' + uid + ':uploads', function (uploadNames, next) {
			async.waterfall([
				function (next) {
					async.each(uploadNames, function (uploadName, next) {
						file.delete(path.join(nconf.get('upload_path'), uploadName), next);
					}, next);
				},
				function (next) {
					db.sortedSetRemove('uid:' + uid + ':uploads', uploadNames, next);
				},
			], next);
		}, { alwaysStartAt: 0 }, callback);
	}

	function removeFromSortedSets(uid, callback) {
		db.sortedSetsRemove([
			'users:joindate',
			'users:postcount',
			'users:reputation',
			'users:banned',
			'users:banned:expire',
			'users:flags',
			'users:online',
			'users:notvalidated',
			'digest:day:uids',
			'digest:week:uids',
			'digest:month:uids',
		], uid, callback);
	}

	User.deleteAccount = function (uid, callback) {
		if (deletesInProgress[uid] === 'user.deleteAccount') {
			return setImmediate(callback, new Error('[[error:already-deleting]]'));
		}
		deletesInProgress[uid] = 'user.deleteAccount';
		var userData;
		async.waterfall([
			function (next) {
				removeFromSortedSets(uid, next);
			},
			function (next) {
				db.getObject('user:' + uid, next);
			},
			function (_userData, next) {
				if (!_userData || !_userData.username) {
					delete deletesInProgress[uid];
					return callback(new Error('[[error:no-user]]'));
				}
				userData = _userData;
				plugins.fireHook('static:user.delete', { uid: uid }, next);
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
					function (next) {
						db.sortedSetRemove('username:uid', userData.username, next);
					},
					function (next) {
						db.sortedSetRemove('username:sorted', userData.username.toLowerCase() + ':' + uid, next);
					},
					function (next) {
						db.sortedSetRemove('userslug:uid', userData.userslug, next);
					},
					function (next) {
						db.sortedSetRemove('fullname:uid', userData.fullname, next);
					},
					function (next) {
						if (userData.email) {
							async.parallel([
								async.apply(db.sortedSetRemove, 'email:uid', userData.email.toLowerCase()),
								async.apply(db.sortedSetRemove, 'email:sorted', userData.email.toLowerCase() + ':' + uid),
							], next);
						} else {
							next();
						}
					},
					function (next) {
						db.decrObjectField('global', 'userCount', next);
					},
					function (next) {
						var keys = [
							'uid:' + uid + ':notifications:read',
							'uid:' + uid + ':notifications:unread',
							'uid:' + uid + ':bookmarks',
							'uid:' + uid + ':followed_tids',
							'uid:' + uid + ':ignored_tids',
							'user:' + uid + ':settings',
							'uid:' + uid + ':topics', 'uid:' + uid + ':posts',
							'uid:' + uid + ':chats', 'uid:' + uid + ':chats:unread',
							'uid:' + uid + ':chat:rooms', 'uid:' + uid + ':chat:rooms:unread',
							'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
							'uid:' + uid + ':ignored:cids', 'uid:' + uid + ':flag:pids',
							'uid:' + uid + ':sessions', 'uid:' + uid + ':sessionUUID:sessionId',
						];
						db.deleteAll(keys, next);
					},
					function (next) {
						deleteUserIps(uid, next);
					},
					function (next) {
						deleteBans(uid, next);
					},
					function (next) {
						deleteUserFromFollowers(uid, next);
					},
					function (next) {
						groups.leaveAllGroups(uid, next);
					},
				], next);
			},
			function (results, next) {
				db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], next);
			},
		], function (err) {
			delete deletesInProgress[uid];
			callback(err, userData);
		});
	};

	function deleteVotes(uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					upvotedPids: async.apply(db.getSortedSetRange, 'uid:' + uid + ':upvote', 0, -1),
					downvotedPids: async.apply(db.getSortedSetRange, 'uid:' + uid + ':downvote', 0, -1),
				}, next);
			},
			function (pids, next) {
				pids = _.uniq(pids.upvotedPids.concat(pids.downvotedPids).filter(Boolean));

				async.eachSeries(pids, function (pid, next) {
					posts.unvote(pid, uid, next);
				}, next);
			},
		], function (err) {
			callback(err);
		});
	}

	function deleteChats(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':chat:rooms', 0, -1, next);
			},
			function (roomIds, next) {
				var userKeys = roomIds.map(function (roomId) {
					return 'uid:' + uid + ':chat:room:' + roomId + ':mids';
				});

				async.parallel([
					async.apply(messaging.leaveRooms, uid, roomIds),
					async.apply(db.deleteAll, userKeys),
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	function deleteUserIps(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':ip', 0, -1, next);
			},
			function (ips, next) {
				var keys = ips.map(function (ip) {
					return 'ip:' + ip + ':uid';
				});
				db.sortedSetsRemove(keys, uid, next);
			},
			function (next) {
				db.delete('uid:' + uid + ':ip', next);
			},
		], callback);
	}

	function deleteBans(uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('uid:' + uid + ':bans:timestamp', 0, -1, next);
			},
			function (bans, next) {
				db.deleteAll(bans, next);
			},
			function (next) {
				db.delete('uid:' + uid + ':bans:timestamp', next);
			},
		], callback);
	}

	function deleteUserFromFollowers(uid, callback) {
		async.parallel({
			followers: async.apply(db.getSortedSetRange, 'followers:' + uid, 0, -1),
			following: async.apply(db.getSortedSetRange, 'following:' + uid, 0, -1),
		}, function (err, results) {
			function updateCount(uids, name, fieldName, next) {
				async.each(uids, function (uid, next) {
					db.sortedSetCard(name + uid, function (err, count) {
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

			var followingSets = results.followers.map(function (uid) {
				return 'following:' + uid;
			});

			var followerSets = results.following.map(function (uid) {
				return 'followers:' + uid;
			});

			async.parallel([
				async.apply(db.sortedSetsRemove, followerSets.concat(followingSets), uid),
				async.apply(updateCount, results.following, 'followers:', 'followerCount'),
				async.apply(updateCount, results.followers, 'following:', 'followingCount'),
			], callback);
		});
	}
};
