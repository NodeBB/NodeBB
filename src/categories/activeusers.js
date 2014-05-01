'use strict';

var async = require('async'),
	db = require('./../database'),
	posts = require('./../posts'),
	topics = require('./../topics');

module.exports = function(Categories) {

	Categories.getActiveUsers = function(cid, callback) {
		db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, 99, function(err, pids) {
			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['uid'], function(err, users) {
				if (err) {
					return callback(err);
				}

				var uids = users.map(function(user) {
					return user.uid;
				}).filter(function(value, index, array) {
					return parseInt(value, 10) !== 0 && array.indexOf(value) === index;
				}).slice(0, 24);

				callback(null, uids);
			});
		});
	};
};
