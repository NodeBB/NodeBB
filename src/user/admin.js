
'use strict';

var async = require('async');
var winston = require('winston');
var validator = require('validator');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (User) {
	User.logIP = function (uid, ip, callback) {
		var now = Date.now();
		async.waterfall([
			function (next) {
				db.sortedSetAdd('uid:' + uid + ':ip', now, ip || 'Unknown', next);
			},
			function (next) {
				if (ip) {
					db.sortedSetAdd('ip:' + ip + ':uid', now, uid, next);
				} else {
					next();
				}
			},
		], callback);
	};

	User.getIPs = function (uid, stop, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop, next);
			},
			function (ips, next) {
				ips = ips.map(function (ip) {
					return validator.escape(String(ip));
				});
				next(null, ips);
			},
		], callback);
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
				plugins.fireHook('filter:user.csvFields', { fields: ['uid', 'email', 'username'] }, next);
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
};
