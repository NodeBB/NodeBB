'use strict';

var async = require('async'),
	db = require('../database'),
	meta = require('../meta'),
	privileges = require('../privileges');

module.exports = function(User) {

	User.isReadyToPost = function(uid, cid, callback) {
		if (parseInt(uid, 10) === 0) {
			return callback();
		}

		async.parallel({
			userData: function(next) {
				User.getUserFields(uid, ['banned', 'lastposttime', 'joindate', 'email', 'email:confirmed', 'reputation'], next);
			},
			exists: function(next) {
				db.exists('user:' + uid, next);
			},
			isAdminOrMod: function(next) {
				privileges.categories.isAdminOrMod(cid, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.exists) {
				return callback(new Error('[[error:no-user]]'));
			}

			if (results.isAdminOrMod) {
				return callback();
			}

			var userData = results.userData;

			if (parseInt(userData.banned, 10) === 1) {
				return callback(new Error('[[error:user-banned]]'));
			}

			if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
				return callback(new Error('[[error:email-not-confirmed]]'));
			}

			var now = Date.now();
			if (now - parseInt(userData.joindate, 10) < parseInt(meta.config.initialPostDelay, 10) * 1000) {
				return callback(new Error('[[error:user-too-new, ' + meta.config.initialPostDelay + ']]'));
			}

			var lastposttime = userData.lastposttime || 0;

			if (parseInt(meta.config.newbiePostDelay, 10) > 0 && parseInt(meta.config.newbiePostDelayThreshold, 10) > parseInt(userData.reputation, 10) && now - parseInt(lastposttime, 10) < parseInt(meta.config.newbiePostDelay, 10) * 1000) {
				return callback(new Error('[[error:too-many-posts-newbie, ' + meta.config.newbiePostDelay + ', ' + meta.config.newbiePostDelayThreshold + ']]'));
			} else if (now - parseInt(lastposttime, 10) < parseInt(meta.config.postDelay, 10) * 1000) {
				return callback(new Error('[[error:too-many-posts, ' + meta.config.postDelay + ']]'));
			}

			callback();
		});
	};

	User.onNewPostMade = function(postData, callback) {
		async.series([
			function(next) {
				User.addPostIdToUser(postData.uid, postData.pid, postData.timestamp, next);
			},
			function(next) {
				User.incrementUserPostCountBy(postData.uid, 1, next);
			},
			function(next) {
				User.setUserField(postData.uid, 'lastposttime', postData.timestamp, next);
			},
			function(next) {
				User.updateLastOnlineTime(postData.uid, next);
			}
		], callback);
	};

	User.addPostIdToUser = function(uid, pid, timestamp, callback) {
		db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid, callback);
	};

	User.addTopicIdToUser = function(uid, tid, timestamp, callback) {
		async.parallel([
			async.apply(db.sortedSetAdd, 'uid:' + uid + ':topics', timestamp, tid),
			async.apply(User.incrementUserFieldBy, uid, 'topiccount', 1)
		], callback);
	};

	User.incrementUserPostCountBy = function(uid, value, callback) {
		callback = callback || function() {};
		User.incrementUserFieldBy(uid, 'postcount', value, function(err, newpostcount) {
			if (err) {
				return callback(err);
			}
			if (!parseInt(uid, 10)) {
				return callback();
			}
			db.sortedSetAdd('users:postcount', newpostcount, uid, callback);
		});
	};

	User.getPostIds = function(uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':posts', start, stop, function(err, pids) {
			callback(err, Array.isArray(pids) ? pids : []);
		});
	};

};