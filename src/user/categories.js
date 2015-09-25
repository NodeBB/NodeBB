'use strict';

var async = require('async');

var db = require('../database');

module.exports = function(User) {

	User.getIgnoredCategories = function(uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':ignored:cids', 0, -1, callback);
	};

	User.getWatchedCategories = function(uid, callback) {
		async.parallel({
			ignored: function(next) {
				User.getIgnoredCategories(uid, next);
			},
			all: function(next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var watched = results.all.filter(function(cid) {
				return cid && results.ignored.indexOf(cid) === -1;
			});
			callback(null, watched);
		});
	};

	User.ignoreCategory = function(uid, cid, callback) {
		if (!uid) {
			return callback();
		}
		db.sortedSetAdd('uid:' + uid + ':ignored:cids', Date.now(), cid, callback);
	};

	User.watchCategory = function(uid, cid, callback) {
		if (!uid) {
			return callback();
		}
		db.sortedSetRemove('uid:' + uid + ':ignored:cids', cid, callback);
	};
};