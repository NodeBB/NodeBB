
'use strict';

var db = require('../database');

module.exports = function(User) {

	User.search = function(query, type, callback) {
		if (!query || query.length === 0) {
			return callback(null, {timing:0, users:[]});
		}
		var start = process.hrtime();

		var set = 'username:uid';
		if (type === 'email') {
			 set = 'email:uid';
		}

		db.getObject(set, function(err, hash) {
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

			uids = uids.slice(0, 10)
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
};
