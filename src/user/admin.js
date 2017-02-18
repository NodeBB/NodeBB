
'use strict';

var async = require('async');
var db = require('../database');
var posts = require('../posts');
var plugins = require('../plugins');
var winston = require('winston');

module.exports = function (User) {

	User.logIP = function (uid, ip) {
		var now = Date.now();
		db.sortedSetAdd('uid:' + uid + ':ip', now, ip || 'Unknown');
		if (ip) {
			db.sortedSetAdd('ip:' + ip + ':uid', now, uid);
		}
	};

	User.getIPs = function (uid, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop, function (err, ips) {
			if (err) {
				return callback(err);
			}

			callback(null, ips);
		});
	};

	User.getUsersCSV = function (callback) {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');
		var csvContent = '';
		var uids;
		async.waterfall([
			function (next) {
				db.getSortedSetRangeWithScores('username:uid', 0, -1, next);
			},
			function (users, next) {
				uids = users.map(function (user) {
					return user.score;
				});
				plugins.fireHook('filter:user.csvFields', {fields: ['uid', 'email', 'username']}, next);
			},
			function (data, next) {
				User.getUsersFields(uids, data.fields, next);
			},
			function (usersData, next) {
				usersData.forEach(function (user) {
					if (user) {
						csvContent += user.email + ',' + user.username + ',' + user.uid + '\n';
					}
				});

				next(null, csvContent);
			},
		], callback);
	};

	User.resetFlags = function (uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback();
		}

		async.eachSeries(uids, function (uid, next) {
			posts.dismissUserFlags(uid, next);
		}, callback);
	};
};
