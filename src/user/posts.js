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
				if (!parseInt(results.userData.uid, 10)) {
					return next(new Error('[[error:no-user]]'));
				}

				if (results.isAdminOrMod) {
					return next();
				}

				var userData = results.userData;

				if (parseInt(userData.banned, 10) === 1) {
					return next(new Error('[[error:user-banned]]'));
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return next(new Error('[[error:email-not-confirmed]]'));
				}

				var now = Date.now();
				if (now - parseInt(userData.joindate, 10) < parseInt(meta.config.initialPostDelay, 10) * 1000) {
					return next(new Error('[[error:user-too-new, ' + meta.config.initialPostDelay + ']]'));
				}

				var lasttime = userData[field] || 0;

				if (parseInt(meta.config.newbiePostDelay, 10) > 0 && parseInt(meta.config.newbiePostDelayThreshold, 10) > parseInt(userData.reputation, 10) && now - parseInt(lasttime, 10) < parseInt(meta.config.newbiePostDelay, 10) * 1000) {
					return next(new Error('[[error:too-many-posts-newbie, ' + meta.config.newbiePostDelay + ', ' + meta.config.newbiePostDelayThreshold + ']]'));
				} else if (now - parseInt(lasttime, 10) < parseInt(meta.config.postDelay, 10) * 1000) {
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
				if (!parseInt(uid, 10)) {
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
