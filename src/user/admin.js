
'use strict';

var async = require('async'),
	db = require('./../database');


module.exports = function(User) {

	User.logIP = function(uid, ip) {
		var now = Date.now();
		db.sortedSetAdd('uid:' + uid + ':ip', now, ip || 'Unknown');
		if (ip) {
			db.sortedSetAdd('ip:' + ip + ':uid', now, uid);
		}
	};

	User.getIPs = function(uid, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop, function(err, ips) {
			if(err) {
				return callback(err);
			}

			callback(null, ips.map(function(ip) {
				return {ip:ip};
			}));
		});
	};

	User.getUsersCSV = function(callback) {
		var csvContent = '';

		async.waterfall([
			function(next) {
				db.getSortedSetRangeWithScores('username:uid', 0, -1, next);
			},
			function(users, next) {
				var uids = users.map(function(user) {
					return user.score;
				});
				User.getUsersFields(uids, ['uid', 'email', 'username'], next);
			},
			function(usersData, next) {
				usersData.forEach(function(user, index) {
					if (user) {
						csvContent += user.email + ',' + user.username + ',' + user.uid + '\n';
					}
				});

				next(null, csvContent);
			}
		], callback);
	};

	User.ban = function(uid, callback) {
		User.setUserField(uid, 'banned', 1, function(err) {
			if (err) {
				return callback(err);
			}
			db.sortedSetAdd('users:banned', Date.now(), uid, callback);
		});
	};

	User.unban = function(uid, callback) {
		db.delete('uid:' + uid + ':flagged_by');
		User.setUserField(uid, 'banned', 0, function(err) {
			if (err) {
				return callback(err);
			}
			db.sortedSetRemove('users:banned', uid, callback);
		});
	};

	User.resetFlags = function(uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback();
		}
		var keys = uids.map(function(uid) {
			return 'uid:' + uid + ':flagged_by';
		});
		db.deleteAll(keys, callback);
	};
};
