
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('./../database'),
	posts = require('./../posts'),
	topics = require('./../topics');

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

	Categories.moveRecentReplies = function(tid, oldCid, cid) {
		function movePost(postData, next) {
			async.parallel([
				function(next) {
					db.sortedSetRemove('categories:recent_posts:cid:' + oldCid, postData.pid, next);
				},
				function(next) {
					db.sortedSetAdd('categories:recent_posts:cid:' + cid, postData.timestamp, postData.pid, next);
				}
			], next);
		}

		topics.getPids(tid, function(err, pids) {
			if (err) {
				return winston.error(err.message);
			}
			if (pids && !pids.length) {
				return;
			}

			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['pid', 'timestamp'], function(err, postData) {
				if (err) {
					return winston.error(err.message);
				}

				async.each(postData, movePost, function(err) {
					if (err) {
						winston.error(err.message);
					}
				});
			});
		});
	};
};


