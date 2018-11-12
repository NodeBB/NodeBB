'use strict';

var async = require('async');
var db = require('../database');
var meta = require('../meta');
var privileges = require('../privileges');

module.exports = function (User) {
	User.isReadyToPost = function (uid, cid, callback) {
		isReady(uid, cid, 'lastposttime', callback);
	};

	User.isReadyToQueue = function (uid, cid, callback) {
		isReady(uid, cid, 'lastqueuetime', callback);
	};

	function isReady(uid, cid, field, callback) {
		if (parseInt(uid, 10) === 0) {
			return callback();
		}
		async.waterfall([
			function (next) {
				async.parallel({
					userData: function (next) {
						User.getUserFields(uid, ['uid', 'banned', 'joindate', 'email', 'email:confirmed', 'reputation'].concat([field]), next);
					},
					isAdminOrMod: function (next) {
						privileges.categories.isAdminOrMod(cid, uid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.userData.uid) {
					return next(new Error('[[error:no-user]]'));
				}

				if (results.isAdminOrMod) {
					return next();
				}

				var userData = results.userData;

				if (userData.banned) {
					return next(new Error('[[error:user-banned]]'));
				}

				if (meta.config.requireEmailConfirmation && !userData['email:confirmed']) {
					return next(new Error('[[error:email-not-confirmed]]'));
				}

				var now = Date.now();
				if (now - userData.joindate < meta.config.initialPostDelay * 1000) {
					return next(new Error('[[error:user-too-new, ' + meta.config.initialPostDelay + ']]'));
				}

				var lasttime = userData[field] || 0;

				if (meta.config.newbiePostDelay > 0 && meta.config.newbiePostDelayThreshold > userData.reputation && now - lasttime < meta.config.newbiePostDelay * 1000) {
					return next(new Error('[[error:too-many-posts-newbie, ' + meta.config.newbiePostDelay + ', ' + meta.config.newbiePostDelayThreshold + ']]'));
				} else if (now - lasttime < meta.config.postDelay * 1000) {
					return next(new Error('[[error:too-many-posts, ' + meta.config.postDelay + ']]'));
				}

				next();
			},
		], callback);
	}

	User.onNewPostMade = function (postData, callback) {
		async.series([
			function (next) {
				User.addPostIdToUser(postData.uid, postData.pid, postData.timestamp, next);
			},
			function (next) {
				User.incrementUserPostCountBy(postData.uid, 1, next);
			},
			function (next) {
				User.setUserField(postData.uid, 'lastposttime', postData.timestamp, next);
			},
			function (next) {
				User.updateLastOnlineTime(postData.uid, next);
			},
		], callback);
	};

	User.addPostIdToUser = function (uid, pid, timestamp, callback) {
		db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid, callback);
	};

	User.incrementUserPostCountBy = function (uid, value, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				User.incrementUserFieldBy(uid, 'postcount', value, next);
			},
			function (newpostcount, next) {
				if (parseInt(uid, 10) <= 0) {
					return next();
				}
				db.sortedSetAdd('users:postcount', newpostcount, uid, next);
			},
		], callback);
	};

	User.getPostIds = function (uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':posts', start, stop, function (err, pids) {
			callback(err, Array.isArray(pids) ? pids : []);
		});
	};
};
