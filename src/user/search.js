
'use strict';

var db = require('./../database');

module.exports = function(User) {
	User.search = function(query, callback) {
		if (!query || query.length === 0) {
			return callback(null, {timing:0, users:[]});
		}
		var start = process.hrtime();

		db.getObject('username:uid', function(err, usernamesHash) {
			if (err) {
				return callback(null, {timing: 0, users:[]});
			}

			query = query.toLowerCase();

			var	usernames = Object.keys(usernamesHash);
			var uids = usernames.filter(function(username) {
				return username.toLowerCase().indexOf(query) === 0;
			})
			.slice(0, 10)
			.sort(function(a, b) {
				return a > b;
			})
			.map(function(username) {
				return usernamesHash[username];
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
};
