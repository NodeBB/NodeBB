

'use strict';

var async = require('async');
var winston = require('winston');
var db = require('../database');
var user = require('../user');
var analytics = require('../analytics');

module.exports = function (Posts) {

	Posts.flag = function (post, uid, reason, callback) {
		if (!parseInt(uid, 10) || !reason) {
			return callback();
		}

		async.waterfall([
			function (next) {
				async.parallel({
					hasFlagged: async.apply(Posts.isFlaggedByUser, post.pid, uid),
					exists: async.apply(Posts.exists, post.pid),
				}, next);
			},
			function (results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-post]]'));
				}

				if (results.hasFlagged) {
					return next(new Error('[[error:already-flagged]]'));
				}

				var now = Date.now();
				async.parallel([
					function (next) {
						db.sortedSetAdd('posts:flagged', now, post.pid, next);
					},
					function (next) {
						db.sortedSetIncrBy('posts:flags:count', 1, post.pid, next);
					},
					function (next) {
						db.incrObjectField('post:' + post.pid, 'flags', next);
					},
					function (next) {
						db.sortedSetAdd('pid:' + post.pid + ':flag:uids', now, uid, next);
					},
					function (next) {
						db.sortedSetAdd('pid:' + post.pid + ':flag:uid:reason', 0, uid + ':' + reason, next);
					},
					function (next) {
						if (parseInt(post.uid, 10)) {
							async.parallel([
								async.apply(db.sortedSetIncrBy, 'users:flags', 1, post.uid),
								async.apply(db.incrObjectField, 'user:' + post.uid, 'flags'),
								async.apply(db.sortedSetAdd, 'uid:' + post.uid + ':flag:pids', now, post.pid),
							], next);
						} else {
							next();
						}
					},
				], next);
			},
			function (data, next) {
				openNewFlag(post.pid, uid, next);
			},
		], function (err) {
			if (err) {
				return callback(err);
			}
			analytics.increment('flags');
			callback();
		});
	};

	function openNewFlag(pid, uid, callback) {
		db.sortedSetScore('posts:flags:count', pid, function (err, count) {
			if (err) {
				return callback(err);
			}
			if (count === 1) {	// Only update state on new flag
				Posts.updateFlagData(uid, pid, {
					state: 'open',
				}, callback);
			} else {
				callback();
			}
		});
	}

	Posts.isFlaggedByUser = function (pid, uid, callback) {
		db.isSortedSetMember('pid:' + pid + ':flag:uids', uid, callback);
	};

	Posts.dismissFlag = function (pid, callback) {
		async.waterfall([
			function (next) {
				db.getObjectFields('post:' + pid, ['pid', 'uid', 'flags'], next);
			},
			function (postData, next) {
				if (!postData.pid) {
					return callback();
				}
				async.parallel([
					function (next) {
						if (parseInt(postData.uid, 10)) {
							if (parseInt(postData.flags, 10) > 0) {
								async.parallel([
									async.apply(db.sortedSetIncrBy, 'users:flags', -postData.flags, postData.uid),
									async.apply(db.incrObjectFieldBy, 'user:' + postData.uid, 'flags', -postData.flags),
								], next);
							} else {
								next();
							}
						} else {
							next();
						}
					},
					function (next) {
						db.sortedSetsRemove([
							'posts:flagged',
							'posts:flags:count',
							'uid:' + postData.uid + ':flag:pids',
						], pid, next);
					},
					function (next) {
						async.series([
							function (next) {
								db.getSortedSetRange('pid:' + pid + ':flag:uids', 0, -1, function (err, uids) {
									if (err) {
										return next(err);
									}

									async.each(uids, function (uid, next) {
										var nid = 'post_flag:' + pid + ':uid:' + uid;
										async.parallel([
											async.apply(db.delete, 'notifications:' + nid),
											async.apply(db.sortedSetRemove, 'notifications', 'post_flag:' + pid + ':uid:' + uid),
										], next);
									}, next);
								});
							},
							async.apply(db.delete, 'pid:' + pid + ':flag:uids'),
						], next);
					},
					async.apply(db.deleteObjectField, 'post:' + pid, 'flags'),
					async.apply(db.delete, 'pid:' + pid + ':flag:uid:reason'),
					async.apply(db.deleteObjectFields, 'post:' + pid, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history']),
				], next);
			},
			function (results, next) {
				db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0, next);
			},
		], callback);
	};

	Posts.dismissAllFlags = function (callback) {
		db.getSortedSetRange('posts:flagged', 0, -1, function (err, pids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(pids, Posts.dismissFlag, callback);
		});
	};

	Posts.dismissUserFlags = function (uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':flag:pids', 0, -1, function (err, pids) {
			if (err) {
				return callback(err);
			}
			async.eachSeries(pids, Posts.dismissFlag, callback);
		});
	};

	Posts.getFlags = function (set, cid, uid, start, stop, callback) {
		async.waterfall([
			function (next) {
				if (Array.isArray(set)) {
					db.getSortedSetRevIntersect({sets: set, start: start, stop: -1, aggregate: 'MAX'}, next);
				} else {
					db.getSortedSetRevRange(set, start, -1, next);
				}
			},
			function (pids, next) {
				if (cid) {
					Posts.filterPidsByCid(pids, cid, next);
				} else {
					process.nextTick(next, null, pids);
				}
			},
			function (pids, next) {
				getFlaggedPostsWithReasons(pids, uid, next);
			},
			function (posts, next) {
				var count = posts.length;
				var end = stop - start + 1;
				next(null, {posts: posts.slice(0, stop === -1 ? undefined : end), count: count});
			},
		], callback);
	};

	function getFlaggedPostsWithReasons(pids, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					uidsReasons: function (next) {
						async.map(pids, function (pid, next) {
							db.getSortedSetRange('pid:' + pid + ':flag:uid:reason', 0, -1, next);
						}, next);
					},
					posts: function (next) {
						Posts.getPostSummaryByPids(pids, uid, {stripTags: false, extraFields: ['flags', 'flag:assignee', 'flag:state', 'flag:notes', 'flag:history']}, next);
					},
				}, next);
			},
			function (results, next) {
				async.map(results.uidsReasons, function (uidReasons, next) {
					async.map(uidReasons, function (uidReason, next) {
						var uid = uidReason.split(':')[0];
						var reason = uidReason.substr(uidReason.indexOf(':') + 1);
						user.getUserFields(uid, ['username', 'userslug', 'picture'], function (err, userData) {
							next(err, {user: userData, reason: reason});
						});
					}, next);
				}, function (err, reasons) {
					if (err) {
						return callback(err);
					}

					results.posts.forEach(function (post, index) {
						if (post) {
							post.flagReasons = reasons[index];
						}
					});

					next(null, results.posts);
				});
			},
			async.apply(Posts.expandFlagHistory),
			function (posts, next) {
				// Parse out flag data into its own object inside each post hash
				async.map(posts, function (postObj, next) {
					for (var prop in postObj) {
						postObj.flagData = postObj.flagData || {};

						if (postObj.hasOwnProperty(prop) && prop.startsWith('flag:')) {
							postObj.flagData[prop.slice(5)] = postObj[prop];

							if (prop === 'flag:state') {
								switch (postObj[prop]) {
									case 'open':
										postObj.flagData.labelClass = 'info';
										break;
									case 'wip':
										postObj.flagData.labelClass = 'warning';
										break;
									case 'resolved':
										postObj.flagData.labelClass = 'success';
										break;
									case 'rejected':
										postObj.flagData.labelClass = 'danger';
										break;
								}
							}

							delete postObj[prop];
						}
					}

					if (postObj.flagData.assignee) {
						user.getUserFields(parseInt(postObj.flagData.assignee, 10), ['username', 'picture'], function (err, userData) {
							if (err) {
								return next(err);
							}

							postObj.flagData.assigneeUser = userData;
							next(null, postObj);
						});
					} else {
						setImmediate(next.bind(null, null, postObj));
					}
				}, next);
			},
		], callback);
	}

	Posts.updateFlagData = function (uid, pid, flagObj, callback) {
		// Retrieve existing flag data to compare for history-saving purposes
		var changes = [];
		var changeset = {};
		var prop;

		Posts.getPostData(pid, function (err, postData) {
			if (err) {
				return callback(err);
			}

			// Track new additions
			for (prop in flagObj) {
				if (flagObj.hasOwnProperty(prop) && !postData.hasOwnProperty('flag:' + prop) && flagObj[prop].length) {
					changes.push(prop);
				}
			}

			// Track changed items
			for (prop in postData) {
				if (
					postData.hasOwnProperty(prop) && prop.startsWith('flag:') &&
					flagObj.hasOwnProperty(prop.slice(5)) &&
					postData[prop] !== flagObj[prop.slice(5)]
				) {
					changes.push(prop.slice(5));
				}
			}

			changeset = changes.reduce(function (memo, prop) {
				memo['flag:' + prop] = flagObj[prop];
				return memo;
			}, {});

			// Append changes to history string
			if (changes.length) {
				try {
					var history = JSON.parse(postData['flag:history'] || '[]');

					changes.forEach(function (property) {
						switch (property) {
							case 'assignee':	// intentional fall-through
							case 'state':
								history.unshift({
									uid: uid,
									type: property,
									value: flagObj[property],
									timestamp: Date.now(),
								});
								break;

							case 'notes':
								history.unshift({
									uid: uid,
									type: property,
									timestamp: Date.now(),
								});
						}
					});

					changeset['flag:history'] = JSON.stringify(history);
				} catch (e) {
					winston.warn('[posts/updateFlagData] Unable to deserialise post flag history, likely malformed data');
				}
			}

			// Save flag data into post hash
			if (changes.length) {
				Posts.setPostFields(pid, changeset, callback);
			} else {
				setImmediate(callback);
			}
		});
	};

	Posts.expandFlagHistory = function (posts, callback) {
		// Expand flag history
		async.map(posts, function (post, next) {
			var history;
			try {
				history = JSON.parse(post['flag:history'] || '[]');
			} catch (e) {
				winston.warn('[posts/getFlags] Unable to deserialise post flag history, likely malformed data');
				return callback(e);
			}

			async.map(history, function (event, next) {
				event.timestampISO = new Date(event.timestamp).toISOString();

				async.parallel([
					function (next) {
						user.getUserFields(event.uid, ['username', 'picture'], function (err, userData) {
							if (err) {
								return next(err);
							}

							event.user = userData;
							next();
						});
					},
					function (next) {
						if (event.type === 'assignee') {
							user.getUserField(parseInt(event.value, 10), 'username', function (err, username) {
								if (err) {
									return next(err);
								}

								event.label = username || 'Unknown user';
								next(null);
							});
						} else if (event.type === 'state') {
							event.label = '[[topic:flag_manage_state_' + event.value + ']]';
							setImmediate(next);
						} else {
							setImmediate(next);
						}
					},
				], function (err) {
					next(err, event);
				});
			}, function (err, history) {
				if (err) {
					return next(err);
				}

				post['flag:history'] = history;
				next(null, post);
			});
		}, callback);
	};
};
