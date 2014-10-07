

'use strict';

var async = require('async'),
	db = require('../database');


module.exports = function(Posts) {
	Posts.flag = function(pid, callback) {
		async.parallel([
			function(next) {
				db.sortedSetAdd('posts:flagged', Date.now(), pid, next);
			},
			function(next) {
				db.incrObjectField('post:' + pid, 'flags', next);
			}
		], function(err, results) {
			callback(err);
		});
	};

	Posts.dismissFlag = function(pid, callback) {
		async.parallel([
			function(next) {
				db.sortedSetRemove('posts:flagged', pid, next);
			},
			function(next) {
				db.deleteObjectField('post:' + pid, 'flags', next);
			}
		], function(err, results) {
			callback(err);
		});
	};

	Posts.getFlags = function(uid, start, end, callback) {
		db.getSortedSetRevRange('posts:flagged', start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			Posts.getPostSummaryByPids(pids, uid, {stripTags: false, extraFields: ['flags']}, callback);
		});
	};
};
