
'use strict';

var async = require('async'),
	db = require('./../database');


module.exports = function(User) {

	User.logIP = function(uid, ip) {
		db.sortedSetAdd('uid:' + uid + ':ip', Date.now(), ip || 'Unknown');
	};

	User.getIPs = function(uid, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ip', 0, end, function(err, ips) {
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
				db.getObjectValues('username:uid', next);
			},
			function(uids, next) {
				User.getMultipleUserFields(uids, ['uid', 'email', 'username'], next);
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
				return callback();
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
};
