'use strict';

var async = require('async');

var db = require('../database');
var topics = require('../topics');
var plugins = require('../plugins');
var meta = require('../meta');

module.exports = function (User) {
	User.updateLastOnlineTime = function (uid, callback) {
		callback = callback || function () {};
		db.getObjectFields('user:' + uid, ['status', 'lastonline'], function (err, userData) {
			var now = Date.now();
			if (err || userData.status === 'offline' || now - parseInt(userData.lastonline, 10) < 300000) {
				return callback(err);
			}
			User.setUserField(uid, 'lastonline', now, callback);
		});
	};

	User.updateOnlineUsers = function (uid, callback) {
		callback = callback || function () {};

		var now = Date.now();
		async.waterfall([
			function (next) {
				db.sortedSetScore('users:online', uid, next);
			},
			function (userOnlineTime, next) {
				if (now - parseInt(userOnlineTime, 10) < 300000) {
					return callback();
				}
				db.sortedSetAdd('users:online', now, uid, next);
			},
			function (next) {
				topics.pushUnreadCount(uid);
				plugins.fireHook('action:user.online', { uid: uid, timestamp: now });
				next();
			},
		], callback);
	};

	User.isOnline = function (uid, callback) {
		var now = Date.now();
		async.waterfall([
			function (next) {
				if (Array.isArray(uid)) {
					db.sortedSetScores('users:online', uid, next);
				} else {
					db.sortedSetScore('users:online', uid, next);
				}
			},
			function (lastonline, next) {
				function checkOnline(lastonline) {
					return (now - lastonline) < (meta.config.onlineCutoff * 60000);
				}

				var isOnline;
				if (Array.isArray(uid)) {
					isOnline = uid.map(function (uid, index) {
						return checkOnline(lastonline[index]);
					});
				} else {
					isOnline = checkOnline(lastonline);
				}
				next(null, isOnline);
			},
		], callback);
	};
};
