
'use strict';

var async = require('async'),
	plugins = require('../plugins'),
	db = require('../database');

module.exports = function(User) {

	User.follow = function(uid, followuid, callback) {
		toggleFollow('follow', uid, followuid, callback);
	};

	User.unfollow = function(uid, unfollowuid, callback) {
		toggleFollow('unfollow', uid, unfollowuid, callback);
	};

	function toggleFollow(type, uid, theiruid, callback) {
		if (!parseInt(uid, 10) || !parseInt(theiruid, 10)) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
			return callback(new Error('[[error:you-cant-follow-yourself]]'));
		}

		async.waterfall([
			function (next) {
				User.exists(theiruid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-user]]'));
				}
				User.isFollowing(uid, theiruid, next);
			},
			function (isFollowing, next) {
				if (type === 'follow') {
					if (isFollowing) {
						return next(new Error('[[error:already-following]]'));
					}
					var now = Date.now();
					async.parallel([
						async.apply(db.sortedSetAdd, 'following:' + uid, now, theiruid),
						async.apply(db.sortedSetAdd, 'followers:' + theiruid, now, uid),
						async.apply(User.incrementUserFieldBy, uid, 'followingCount', 1),
						async.apply(User.incrementUserFieldBy, theiruid, 'followerCount', 1)
					], next);
				} else {
					if (!isFollowing) {
						return next(new Error('[[error:not-following]]'));
					}
					async.parallel([
						async.apply(db.sortedSetRemove, 'following:' + uid, theiruid),
						async.apply(db.sortedSetRemove, 'followers:' + theiruid, uid),
						async.apply(User.decrementUserFieldBy, uid, 'followingCount', 1),
						async.apply(User.decrementUserFieldBy, theiruid, 'followerCount', 1)
					], next);
				}
			}
		], callback);
	}

	User.getFollowing = function(uid, start, stop, callback) {
		getFollow(uid, 'following', start, stop, callback);
	};

	User.getFollowers = function(uid, start, stop, callback) {
		getFollow(uid, 'followers', start, stop, callback);
	};

	function getFollow(uid, type, start, stop, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, []);
		}

		db.getSortedSetRevRange(type + ':' + uid, start, stop, function(err, uids) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('filter:user.' + type, {
				uids: uids,
				uid: uid,
				start: start,
				stop: stop
			}, function(err, data) {
				User.getUsers(data.uids, uid, callback);
			});
		});
	}

	User.isFollowing = function(uid, theirid, callback) {
		if (!parseInt(uid, 10) || !parseInt(theirid, 10)) {
			return callback(null, false);
		}
		db.isSortedSetMember('following:' + uid, theirid, callback);
	};

};
