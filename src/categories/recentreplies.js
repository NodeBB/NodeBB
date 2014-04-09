
'use strict';

var async = require('async'),
	db = require('./../database'),
	posts = require('./../posts'),
	topics = require('./../topics'),
	CategoryTools = require('./../categoryTools');

module.exports = function(Categories) {
	Categories.getRecentReplies = function(cid, uid, count, callback) {
		if(!parseInt(count, 10)) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, count - 1, function(err, pids) {
			if (err || !pids || !pids.length) {
				return callback(err, []);
			}

			posts.getPostSummaryByPids(pids, true, callback);
		});
	};

	Categories.moveRecentReplies = function(tid, oldCid, cid, callback) {
		function movePost(pid, callback) {
			posts.getPostField(pid, 'timestamp', function(err, timestamp) {
				if(err) {
					return callback(err);
				}

				db.sortedSetRemove('categories:recent_posts:cid:' + oldCid, pid);
				db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid);
				callback();
			});
		}

		topics.getPids(tid, function(err, pids) {
			if(err) {
				return callback(err);
			}

			async.each(pids, movePost, callback);
		});
	};
};


