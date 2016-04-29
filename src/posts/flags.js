

'use strict';

var async = require('async'),
	db = require('../database'),
	user = require('../user');


module.exports = function(Posts) {

	Posts.flag = function(post, uid, reason, callback) {
		if (!parseInt(uid, 10) || !reason) {
			return callback();
		}
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
					db.sortedSetAdd('pid:' + post.pid + ':flag:uid:reason', 0, uid + ':' + reason, next);
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
			], function(err) {
				callback(err);
			});
		});
	};

	function hasFlagged(pid, uid, callback) {
		db.isSortedSetMember('pid:' + pid + ':flag:uids', uid, callback);
	}

	Posts.dismissFlag = function(pid, callback) {
		var uid;

		async.parallel([
			function(next) {
				db.getObjectField('post:' + pid, 'uid', function(err, _uid) {
					if (err) {
						return next(err);
					}

					uid = _uid;

					db.sortedSetsRemove([
						'posts:flagged',
						'posts:flags:count',
						'uid:' + uid + ':flag:pids'
					], pid, next);
				});
			},
			function(next) {
				async.series([
					function(next) {
						db.getSortedSetRange('pid:' + pid + ':flag:uids', 0, -1, function(err, uids) {
							async.each(uids, function(uid, next) {
								var nid = 'post_flag:' + pid + ':uid:' + uid;
								async.parallel([
									async.apply(db.delete, 'notifications:' + nid),
									async.apply(db.sortedSetRemove, 'notifications', 'post_flag:' + pid + ':uid:' + uid)
								], next);
							}, next);
						});
					},
					async.apply(db.delete, 'pid:' + pid + ':flag:uids')
				], next);
			},
			async.apply(db.deleteObjectField, 'post:' + pid, 'flags'),
			async.apply(db.delete, 'pid:' + pid + ':flag:uid:reason')
		], function(err) {
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
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange(set, start, stop, next);
			},
			function (pids, next) {
				getFlaggedPostsWithReasons(pids, uid, next);
			}
		], callback);
	};

	function getFlaggedPostsWithReasons(pids, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					uidsReasons: function(next) {
						async.map(pids, function(pid, next) {
							db.getSortedSetRange('pid:' + pid + ':flag:uid:reason', 0, -1, next);
						}, next);
					},
					posts: function(next) {
						Posts.getPostSummaryByPids(pids, uid, {stripTags: false, extraFields: ['flags']}, next);
					}
				}, next);
			},
			function (results, next) {
				async.map(results.uidsReasons, function(uidReasons, next) {
					async.map(uidReasons, function(uidReason, next) {
						var uid = uidReason.split(':')[0];
						var reason = uidReason.substr(uidReason.indexOf(':') + 1);
						user.getUserFields(uid, ['username', 'userslug', 'picture'], function(err, userData) {
							next(err, {user: userData, reason: reason});
						});
					}, next);
				}, function(err, reasons) {
					if (err) {
						return callback(err);
					}

					results.posts.forEach(function(post, index) {
						if (post) {
							post.flagReasons = reasons[index];
						}
					});

					next(null, results.posts);
				});
			}
		], callback);
	}

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
				getFlaggedPostsWithReasons(pids, callerUID, next);
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
