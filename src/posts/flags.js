

'use strict';

var async = require('async'),
	db = require('../database'),
	user = require('../user');


module.exports = function(Posts) {

	Posts.flag = function(post, uid, callback) {
		async.parallel({
			hasFlagged: async.apply(hasFlagged, post.pid, uid),
			exists: async.apply(Posts.exists, post.pid)
		}, function(err, results) {
			if (err || !results.exists) {
				return callback(err || new Error('[[error:no-post]]'));
			}

			if (results.hasFlagged) {
				return callback(new Error('[[error:already-flagged]]'));
			}
			var now = Date.now();

			async.parallel([
				function(next) {
					db.sortedSetAdd('posts:flagged', now, post.pid, next);
				},
				function(next) {
					db.sortedSetIncrBy('posts:flags:count', 1, post.pid, next);
				},
				function(next) {
					db.incrObjectField('post:' + post.pid, 'flags', next);
				},
				function(next) {
					db.sortedSetAdd('pid:' + post.pid + ':flag:uids', now, uid, next);
				},
				function(next) {
					if (parseInt(post.uid, 10)) {
						db.sortedSetAdd('uid:' + post.uid + ':flag:pids', now, post.pid, next);
					} else {
						next();
					}
				},
				function(next) {
					if (parseInt(post.uid, 10)) {
						db.setAdd('uid:' + post.uid + ':flagged_by', uid, next);
					} else {
						next();
					}
				}
			], function(err, results) {
				callback(err);
			});
		});
	};

	function hasFlagged(pid, uid, callback) {
		db.isSortedSetMember('pid:' + pid + ':flag:uids', uid, callback);
	}

	Posts.dismissFlag = function(pid, callback) {
		async.parallel([
			function(next) {
				db.getObjectField('post:' + pid, 'uid', function(err, uid) {
					if (err) {
						return next(err);
					}

					db.sortedSetsRemove([
						'posts:flagged',
						'posts:flags:count',
						'uid:' + uid + ':flag:pids'
					], pid, next);
				});
			},
			function(next) {
				db.deleteObjectField('post:' + pid, 'flags', next);
			},
			function(next) {
				db.delete('pid:' + pid + ':flag:uids', next);
			}
		], function(err, results) {
			callback(err);
		});
	};

	Posts.dismissAllFlags = function(callback) {
		db.getSortedSetRange('posts:flagged', 0, -1, function(err, pids) {
			if (err) {
				return callback(err);
			}
			async.eachLimit(pids, 50, Posts.dismissFlag, callback);
		});
	};

	Posts.getFlags = function(set, uid, start, stop, callback) {
		db.getSortedSetRevRange(set, start, stop, function(err, pids) {
			if (err) {
				return callback(err);
			}

			Posts.getPostSummaryByPids(pids, uid, {stripTags: false, extraFields: ['flags']}, callback);
		});
	};

	Posts.getUserFlags = function(byUsername, sortBy, callerUID, start, stop, callback) {
		async.waterfall([
			function(next) {
				user.getUidByUsername(byUsername, next);
			},
			function(uid, next) {
				if (!uid) {
					return next(null, []);
				}
				db.getSortedSetRevRange('uid:' + uid + ':flag:pids', 0, -1, next);
			},
			function(pids, next) {
				Posts.getPostSummaryByPids(pids, callerUID, {stripTags: false, extraFields: ['flags']}, next);
			},
			function(posts, next) {
				if (sortBy === 'count') {
					posts.sort(function(a, b) {
						return b.flags - a.flags;
					});
				}
				next(null, posts.slice(start, stop));
			}
		], callback);
	};
};
