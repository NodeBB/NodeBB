
'use strict';

var async = require('async'),
	db = require('../database');

module.exports = function(User) {

	User.search = function(query, type, callback) {
		if (!query || query.length === 0) {
			return callback(null, {timing:0, users:[]});
		}

		if (type === 'ip') {
			return searchByIP(query, callback);
		}

		var start = process.hrtime();
		var key = 'username:uid';
		if (type === 'email') {
			 key = 'email:uid';
		}

		db.getObject(key, function(err, hash) {
			if (err) {
				return callback(null, {timing: 0, users:[]});
			}

			query = query.toLowerCase();

			var	values = Object.keys(hash);
			var uids = [];

			for(var i=0; i<values.length; ++i) {
				if (values[i].toLowerCase().indexOf(query) === 0) {
					uids.push(values[i]);
				}
			}

			uids = uids.slice(0, 20)
				.sort(function(a, b) {
					return a > b;
				})
				.map(function(username) {
					return hash[username];
				});

			User.getUsers(uids, function(err, userdata) {
				if (err) {
					return callback(err);
				}

				var diff = process.hrtime(start);
				var timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
				callback(null, {timing: timing, users: userdata});
			});
		});
	};

	function searchByIP(ip, callback) {
		var start = process.hrtime();
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('ip:' + ip + ':uid', 0, -1, next);
			},
			function(uids, next) {
				User.getUsers(uids, next);
			},
			function(users, next) {
				var diff = process.hrtime(start);
				var timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
				next(null, {timing: timing, users: users});
			}
		], callback);
	}
};
