'use strict';

var async = require('async'),
	db = require('../database');

module.exports = function(Categories) {

	Categories.getActiveUsers = function(cid, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, 24, next);
			},
			function(pids, next) {
				var keys = pids.map(function(pid) {
					return 'post:' + pid;
				});

				db.getObjectsFields(keys, ['uid'], next);
			},
			function(users, next) {
				var uids = users.map(function(user) {
					return user.uid;
				}).filter(function(value, index, array) {
					return parseInt(value, 10) !== 0 && array.indexOf(value) === index;
				}).slice(0, 24);

				callback(null, uids);
			}
		], callback);
	};
};
