
'use strict';

var async = require('async'),
	db = require('./../database');

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

		var command = type === 'follow' ? 'setAdd' : 'setRemove';
		db[command]('following:' + uid, theiruid, function(err) {
			if(err) {
				return callback(err);
			}
			db[command]('followers:' + theiruid, uid, callback);
		});
	}

	User.getFollowing = function(uid, callback) {
		getFollow('following:' + uid, callback);
	};

	User.getFollowers = function(uid, callback) {
		getFollow('followers:' + uid, callback);
	};

	function getFollow(set, callback) {
		db.getSetMembers(set, function(err, uids) {
			if(err) {
				return callback(err);
			}

			User.getUsers(uids, callback);
		});
	}

	User.getFollowingCount = function(uid, callback) {
		db.setCount('following:' + uid, callback);
	};

	User.getFollowerCount = function(uid, callback) {
		db.setCount('followers:' + uid, callback);
	};

	User.getFollowStats = function (uid, callback) {
		async.parallel({
			followingCount: function(next) {
				User.getFollowingCount(uid, next);
			},
			followerCount : function(next) {
				User.getFollowerCount(uid, next);
			}
		}, callback);
	};

	User.isFollowing = function(uid, theirid, callback) {
		db.isSetMember('following:' + uid, theirid, callback);
	};

};
