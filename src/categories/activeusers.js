'use strict';

var async = require('async'),

	db = require('./../database'),
	posts = require('./../posts'),
	topics = require('./../topics');

module.exports = function(Categories) {

	Categories.isUserActiveIn = function(cid, uid, callback) {

		db.getSortedSetRange('uid:' + uid + ':posts', 0, -1, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var index = 0,
				active = false;

			async.whilst(
				function() {
					return active === false && index < pids.length;
				},
				function(callback) {
					posts.getCidByPid(pids[index], function(err, postCid) {
						if (err) {
							return callback(err);
						}

						if (postCid === cid) {
							active = true;
						}

						++index;
						callback();
					});
				},
				function(err) {
					callback(err, active);
				}
			);
		});
	};

	Categories.addActiveUser = function(cid, uid, timestamp) {
		if(parseInt(uid, 10)) {
			db.sortedSetAdd('cid:' + cid + ':active_users', timestamp, uid);
		}
	};

	Categories.removeActiveUser = function(cid, uid, callback) {
		db.sortedSetRemove('cid:' + cid + ':active_users', uid, callback);
	};

	Categories.getActiveUsers = function(cid, callback) {
		db.getSortedSetRevRange('cid:' + cid + ':active_users', 0, 23, callback);
	};

	Categories.moveActiveUsers = function(tid, oldCid, cid, callback) {
		function updateUser(uid, timestamp) {
			Categories.addActiveUser(cid, uid, timestamp);
			Categories.isUserActiveIn(oldCid, uid, function(err, active) {

				if (!err && !active) {
					Categories.removeActiveUser(oldCid, uid);
				}
			});
		}

		topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
			if(!err) {
				topics.getUids(tid, function(err, uids) {
					if (!err && uids) {
						for (var i = 0; i < uids.length; ++i) {
							updateUser(uids[i], timestamp);
						}
					}
				});
			}
		});
	};
};
