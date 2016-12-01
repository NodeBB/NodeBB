

'use strict';

var async = require('async');
var winston = require('winston');
var db = require('./database');
var user = require('./user');
var analytics = require('./analytics');
var topics = require('./topics');
var posts = require('./posts');
var utils = require('../public/src/utils');
var _ = require('underscore');

var Flags = {
	_defaults: {
		state: 'open',
		assignee: null
	}
};

Flags.get = function (flagId, callback) {
	async.waterfall([
		// First stage
		async.apply(async.parallel, {
			base: async.apply(db.getObject.bind(db), 'flag:' + flagId),
			history: async.apply(db.getSortedSetRevRange.bind(db), 'flag:' + flagId + ':history', 0, -1),
			notes: async.apply(Flags.getNotes, flagId)
		}),
		function (data, next) {
			// Second stage
			async.parallel({
				userObj: async.apply(user.getUserFields, data.base.uid, ['username', 'picture']),
				targetObj: async.apply(Flags.getTarget, data.base.type, data.base.targetId, data.base.uid)
			}, function (err, payload) {
				// Final object return construction
				next(err, Object.assign(data.base, {
					datetimeISO: new Date(data.base.datetime).toISOString(),
					target_readable: data.base.type.charAt(0).toUpperCase() + data.base.type.slice(1) + ' ' + data.base.targetId,
					target: payload.targetObj,
					history: data.history,
					notes: data.notes,
					reporter: {
						username: payload.userObj.username,
						picture: payload.userObj.picture,
						'icon:bgColor': payload.userObj['icon:bgColor'],
						'icon:text': payload.userObj['icon:text']
					}
				}));
			});
		}
	], callback);
};

Flags.list = function (filters, callback) {
	if (typeof filters === 'function' && !callback) {
		callback = filters;
		filters = {};
	}

	async.waterfall([
		async.apply(db.getSortedSetRevRange.bind(db), 'flags:datetime', 0, 19),
		function (flagIds, next) {
			async.map(flagIds, function (flagId, next) {
				async.waterfall([
					async.apply(db.getObject, 'flag:' + flagId),
					function (flagObj, next) {
						user.getUserFields(flagObj.uid, ['username', 'picture'], function (err, userObj) {
							next(err, Object.assign(flagObj, {
								reporter: {
									username: userObj.username,
									picture: userObj.picture,
									'icon:bgColor': userObj['icon:bgColor'],
									'icon:text': userObj['icon:text']
								}
							}));
						});
					}
				], function (err, flagObj) {
					if (err) {
						return next(err);
					}

					switch(flagObj.state) {
						case 'open':
							flagObj.labelClass = 'info';
							break;
						case 'wip':
							flagObj.labelClass = 'warning';
							break;
						case 'resolved':
							flagObj.labelClass = 'success';
							break;
						case 'rejected':
							flagObj.labelClass = 'danger';
							break;
					}

					next(null, Object.assign(flagObj, {
						target_readable: flagObj.type.charAt(0).toUpperCase() + flagObj.type.slice(1) + ' ' + flagObj.targetId,
						datetimeISO: new Date(parseInt(flagObj.datetime, 10)).toISOString()
					}));
				});
			},  next);
		}
	], function (err, flags) {
		if (err) {
			return callback(err);
		}

		return callback(null, flags);
	});
};

Flags.getTarget = function (type, id, uid, callback) {
	switch (type) {
		case 'post':
			async.waterfall([
				async.apply(posts.getPostsByPids, [id], uid),
				function (posts, next) {
					topics.addPostData(posts, uid, next);
				}
			], function (err, posts) {
				callback(err, posts[0]);
			});
			break;
		
		case 'user':
			user.getUsersData([id], function (err, users) {
				callback(err, users ? users[0] : undefined);
			});
			break;
	}
};

Flags.getNotes = function (flagId, callback) {
	async.waterfall([
		async.apply(db.getSortedSetRevRangeWithScores.bind(db), 'flag:' + flagId + ':notes', 0, -1),
		function (notes, next) {
			var uids = [];
			var noteObj;
			notes = notes.map(function (note) {
				try {
					noteObj = JSON.parse(note.value);
					uids.push(noteObj[0]);
					return {
						uid: noteObj[0],
						content: noteObj[1],
						datetime: note.score,
						datetimeISO: new Date(note.score).toISOString()
					};
				} catch (e) {
					return next(e);
				}
			});
			next(null, notes, uids);
		},
		function (notes, uids, next) {
			user.getUsersData(uids, function (err, users) {
				if (err) {
					return next(err);
				}

				next(null, notes.map(function (note, idx) {
					note.user = users[idx];
					return note;
				}));
			});
		}
	], callback);
};

Flags.create = function (type, id, uid, reason, callback) {
	async.waterfall([
		function (next) {
			// Sanity checks
			async.parallel([
				async.apply(Flags.exists, type, id, uid),
				async.apply(Flags.targetExists, type, id)
			], function (err, checks) {
				if (err) {
					return next(err);
				}

				if (checks[0]) {
					return next(new Error('[[error:already-flagged]]'));
				} else if (!checks[1]) {
					return next(new Error('[[error:invalid-data]]'));
				} else {
					next();
				}
			});
		},
		async.apply(db.incrObjectField, 'global', 'nextFlagId'),
		function (flagId, next) {
			async.parallel([
				async.apply(db.setObject.bind(db), 'flag:' + flagId, Object.assign({}, Flags._defaults, {
					flagId: flagId,
					type: type,
					targetId: id,
					description: reason,
					uid: uid,
					datetime: Date.now()
				})),
				async.apply(db.sortedSetAdd.bind(db), 'flags:datetime', Date.now(), flagId),
				async.apply(db.setObjectField.bind(db), 'flagHash:flagId', [type, id, uid].join(':'), flagId)
			], function (err, data) {
				if (err) {
					return next(err);
				}

				next(null, flagId);
			});
		},
		async.apply(Flags.get)
	], callback);
	// if (!parseInt(uid, 10) || !reason) {
	// 	return callback();
	// }

	// async.waterfall([
	// 	function (next) {
	// 		async.parallel({
	// 			hasFlagged: async.apply(Flags.isFlaggedByUser, post.pid, uid),
	// 			exists: async.apply(Posts.exists, post.pid)
	// 		}, next);
	// 	},
	// 	function (results, next) {
	// 		if (!results.exists) {
	// 			return next(new Error('[[error:no-post]]'));
	// 		}

	// 		if (results.hasFlagged) {
	// 			return next(new Error('[[error:already-flagged]]'));
	// 		}

	// 		var now = Date.now();
	// 		async.parallel([
	// 			function (next) {
	// 				db.sortedSetAdd('posts:flagged', now, post.pid, next);
	// 			},
	// 			function (next) {
	// 				db.sortedSetIncrBy('posts:flags:count', 1, post.pid, next);
	// 			},
	// 			function (next) {
	// 				db.incrObjectField('post:' + post.pid, 'flags', next);
	// 			},
	// 			function (next) {
	// 				db.sortedSetAdd('pid:' + post.pid + ':flag:uids', now, uid, next);
	// 			},
	// 			function (next) {
	// 				db.sortedSetAdd('pid:' + post.pid + ':flag:uid:reason', 0, uid + ':' + reason, next);
	// 			},
	// 			function (next) {
	// 				if (parseInt(post.uid, 10)) {
	// 					async.parallel([
	// 						async.apply(db.sortedSetIncrBy, 'users:flags', 1, post.uid),
	// 						async.apply(db.incrObjectField, 'user:' + post.uid, 'flags'),
	// 						async.apply(db.sortedSetAdd, 'uid:' + post.uid + ':flag:pids', now, post.pid)
	// 					], next);
	// 				} else {
	// 					next();
	// 				}
	// 			}
	// 		], next);
	// 	},
	// 	function (data, next) {
	// 		openNewFlag(post.pid, uid, next);		// removed, used to just update flag to open state if new flag
	// 	}
	// ], function (err) {
	// 	if (err) {
	// 		return callback(err);
	// 	}
	// 	analytics.increment('flags');
	// 	callback();
	// });
};

Flags.exists = function (type, id, uid, callback) {
	db.isObjectField('flagHash:flagId', [type, id, uid].join(':'), callback);
};

Flags.targetExists = function (type, id, callback) {
	switch (type) {
		case 'topic':
			topics.exists(id, callback);
			break;
		
		case 'post':
			posts.exists(id, callback);
			break;
	}
};

/* new signature (type, id, uid, callback) */
Flags.isFlaggedByUser = function (pid, uid, callback) {
	db.isSortedSetMember('pid:' + pid + ':flag:uids', uid, callback);
};

Flags.dismiss = function (pid, callback) {
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
								async.apply(db.incrObjectFieldBy, 'user:' + postData.uid, 'flags', -postData.flags)
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
						'uid:' + postData.uid + ':flag:pids'
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
										async.apply(db.sortedSetRemove, 'notifications', 'post_flag:' + pid + ':uid:' + uid)
									], next);
								}, next);
							});
						},
						async.apply(db.delete, 'pid:' + pid + ':flag:uids')
					], next);
				},
				async.apply(db.deleteObjectField, 'post:' + pid, 'flags'),
				async.apply(db.delete, 'pid:' + pid + ':flag:uid:reason'),
				async.apply(db.deleteObjectFields, 'post:' + pid, ['flag:state', 'flag:assignee', 'flag:notes', 'flag:history'])
			], next);
		},
		function (results, next) {
			db.sortedSetsRemoveRangeByScore(['users:flags'], '-inf', 0, next);
		}
	], callback);
};

// Pretty sure we don't need this method...
Flags.dismissAll = function (callback) {
	db.getSortedSetRange('posts:flagged', 0, -1, function (err, pids) {
		if (err) {
			return callback(err);
		}
		async.eachSeries(pids, Flags.dismiss, callback);
	});
};

Flags.dismissByUid = function (uid, callback) {
	db.getSortedSetRange('uid:' + uid + ':flag:pids', 0, -1, function (err, pids) {
		if (err) {
			return callback(err);
		}
		async.eachSeries(pids, Flags.dismiss, callback);
	});
};

// This is the old method to get list of flags, supercede by Flags.list();
// Flags.get = function (set, cid, uid, start, stop, callback) {
// 	async.waterfall([
// 		function (next) {
// 			if (Array.isArray(set)) {
// 				db.getSortedSetRevIntersect({sets: set, start: start, stop: -1, aggregate: 'MAX'}, next);
// 			} else {
// 				db.getSortedSetRevRange(set, start, -1, next);
// 			}
// 		},
// 		function (pids, next) {
// 			if (cid) {
// 				posts.filterPidsByCid(pids, cid, next);
// 			} else {
// 				process.nextTick(next, null, pids);
// 			}
// 		},
// 		function (pids, next) {
// 			getFlaggedPostsWithReasons(pids, uid, next);
// 		},
// 		function (posts, next) {
// 			var count = posts.length;
// 			var end = stop - start + 1;
// 			next(null, {posts: posts.slice(0, stop === -1 ? undefined : end), count: count});
// 		}
// 	], callback);
// };

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
					posts.getPostSummaryByPids(pids, uid, {stripTags: false, extraFields: ['flags', 'flag:assignee', 'flag:state', 'flag:notes', 'flag:history']}, next);
				}
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
		async.apply(Flags.expandFlagHistory),
		function (posts, next) {
			// Parse out flag data into its own object inside each post hash
			async.map(posts, function (postObj, next) {
				for(var prop in postObj) {
					postObj.flagData = postObj.flagData || {};

					if (postObj.hasOwnProperty(prop) && prop.startsWith('flag:')) {
						postObj.flagData[prop.slice(5)] = postObj[prop];

						if (prop === 'flag:state') {
							switch(postObj[prop]) {
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
		}
	], callback);
}

// New method signature (type, id, flagObj, callback) and name (.update())
// uid used in history string, which should be rewritten too.
Flags.update = function (uid, pid, flagObj, callback) {
	// Retrieve existing flag data to compare for history-saving purposes
	var changes = [];
	var changeset = {};
	var prop;

	posts.getPostData(pid, function (err, postData) {
		if (err) {
			return callback(err);
		}

		// Track new additions
		for(prop in flagObj) {
			if (flagObj.hasOwnProperty(prop) && !postData.hasOwnProperty('flag:' + prop) && flagObj[prop].length) {
				changes.push(prop);
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

		changeset = changes.reduce(function (memo, prop) {
			memo['flag:' + prop] = flagObj[prop];
			return memo;
		}, {});

		// Append changes to history string
		if (changes.length) {
			try {
				var history = JSON.parse(postData['flag:history'] || '[]');

				changes.forEach(function (property) {
					switch(property) {
						case 'assignee':	// intentional fall-through
						case 'state':
							history.unshift({
								uid: uid,
								type: property,
								value: flagObj[property],
								timestamp: Date.now()
							});
							break;

						case 'notes':
							history.unshift({
								uid: uid,
								type: property,
								timestamp: Date.now()
							});
					}
				});

				changeset['flag:history'] = JSON.stringify(history);
			} catch (e) {
				winston.warn('[flags/update] Unable to deserialise post flag history, likely malformed data');
			}
		}

		// Save flag data into post hash
		if (changes.length) {
			posts.setPostFields(pid, changeset, callback);
		} else {
			setImmediate(callback);
		}
	});
};

// To be rewritten and deprecated
Flags.expandFlagHistory = function (posts, callback) {
	// Expand flag history
	async.map(posts, function (post, next) {
		var history;
		try {
			history = JSON.parse(post['flag:history'] || '[]');
		} catch (e) {
			winston.warn('[flags/get] Unable to deserialise post flag history, likely malformed data');
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
				}
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

module.exports = Flags;