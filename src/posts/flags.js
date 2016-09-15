

'use strict';

var async = require('async');
var db = require('../database');
var user = require('../user');
var analytics = require('../analytics');

module.exports = function(Posts) {

	Posts.flag = function(post, uid, reason, callback) {
		if (!parseInt(uid, 10) || !reason) {
			return callback();
		}

		async.waterfall([
			function(next) {
				async.parallel({
					hasFlagged: async.apply(hasFlagged, post.pid, uid),
					exists: async.apply(Posts.exists, post.pid)
				}, next);
			},
			function(results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-post]]'));
				}

				if (results.hasFlagged) {
					return next(new Error('[[error:already-flagged]]'));
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
							async.parallel([
								async.apply(db.sortedSetIncrBy, 'users:flags', 1, post.uid),
								async.apply(db.incrObjectField, 'user:' + post.uid, 'flags'),
								async.apply(db.sortedSetAdd, 'uid:' + post.uid + ':flag:pids', now, post.pid)
							], next);
						} else {
							next();
						}
					}
				], next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			analytics.increment('flags');
			callback();
		});
	};

	function hasFlagged(pid, uid, callback) {
		db.isSortedSetMember('pid:' + pid + ':flag:uids', uid, callback);
	}

	Posts.dismissFlag = function(pid, callback) {
		async.waterfall([
			function(next) {
				db.getObjectFields('post:' + pid, ['pid', 'uid', 'flags'], next);
			},
			function(postData, next) {
				if (!postData.pid) {
					return callback();
				}
				async.parallel([
					function(next) {
						if (parseInt(postData.uid, 10)) {
							if (parseInt(postData.flags, 10) > 0) {
								async.parallel([
									async.apply(db.sortedSetIncrBy, 'users:flags', -postData.flags, postData.uid),
									async.apply(db.incrObjectFieldBy, 'user:' + postData.uid, 'flags', -postData.flags)
								], next);
							} else {
								next();
							}
						}
					},
					function(next) {
						db.sortedSetsRemove([
							'posts:flagged',
							'posts:flags:count',
							'uid:' + postData.uid + ':flag:pids'
						], pid, next);
					},
					function(next) {
						async.series([
							function(next) {
								db.getSortedSetRange('pid:' + pid + ':flag:uids', 0, -1, function(err, uids) {
									if (err) {
										return next(err);
									}

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
				], next);
			},
			function(results, next) {
				db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0, next);
			}
		], callback);
	};

	Posts.dismissAllFlags = function(callback) {
		db.getSortedSetRange('posts:flagged', 0, -1, function(err, pids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(pids, Posts.dismissFlag, callback);
		});
	};

	Posts.dismissUserFlags = function(uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':flag:pids', 0, -1, function(err, pids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(pids, Posts.dismissFlag, callback);
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

	Posts.updateFlagData = function(pid, flagObj, callback) {
		// Retrieve existing flag data to compare for history-saving purposes
		var changes = [];
		var changeset = {};
		var prop;
		Posts.getPostData(pid, function(err, postData) {
			// Track new additions
			for(prop in flagObj) {
				if (flagObj.hasOwnProperty(prop) && !postData.hasOwnProperty('flag:' + prop)) {
					changes.push(prop);
				}

				// Generate changeset for object modification
				if (flagObj.hasOwnProperty(prop)) {
					changeset['flag:' + prop] = flagObj[prop];
				}
			}

			// Track changed items
			for(prop in postData) {
				if (
					postData.hasOwnProperty(prop) && prop.startsWith('flag:') &&
					flagObj.hasOwnProperty(prop.slice(5)) &&
					postData[prop] !== flagObj[prop.slice(5)]
				) {
					changes.push(prop.slice(5));
				}
			}

			// Save flag data into post hash
			Posts.setPostFields(pid, changeset, callback);
		});
	};
};
