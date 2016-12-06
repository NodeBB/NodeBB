'use strict';

var async = require('async');
var winston = require('winston');
var db = require('./database');
var user = require('./user');
var groups = require('./groups');
var meta = require('./meta');
var notifications = require('./notifications');
var analytics = require('./analytics');
var topics = require('./topics');
var posts = require('./posts');
var privileges = require('./privileges');
var plugins = require('./plugins');
var utils = require('../public/src/utils');
var _ = require('underscore');
var S = require('string');

var Flags = {};

Flags.get = function (flagId, callback) {
	async.waterfall([
		// First stage
		async.apply(async.parallel, {
			base: async.apply(db.getObject.bind(db), 'flag:' + flagId),
			history: async.apply(Flags.getHistory, flagId),
			notes: async.apply(Flags.getNotes, flagId)
		}),
		function (data, next) {
			// Second stage
			async.parallel({
				userObj: async.apply(user.getUserFields, data.base.uid, ['username', 'userslug', 'picture']),
				targetObj: async.apply(Flags.getTarget, data.base.type, data.base.targetId, data.base.uid)
			}, function (err, payload) {
				// Final object return construction
				next(err, Object.assign(data.base, {
					datetimeISO: new Date(data.base.datetime).toISOString(),
					target_readable: data.base.type.charAt(0).toUpperCase() + data.base.type.slice(1) + ' ' + data.base.targetId,
					target: payload.targetObj,
					history: data.history,
					notes: data.notes,
					reporter: payload.userObj
				}));
			});
		}
	], callback);
};

Flags.list = function (filters, uid, callback) {
	if (typeof filters === 'function' && !callback) {
		callback = filters;
		filters = {};
	}

	var sets = [];
	if (Object.keys(filters).length > 0) {
		for (var type in filters) {
			switch (type) {
				case 'type':
					sets.push('flags:byType:' + filters[type]);
					break;

				case 'state':
					sets.push('flags:byState:' + filters[type]);
					break;
				
				case 'reporterId':
					sets.push('flags:byReporter:' + filters[type]);
					break;
				
				case 'assignee':
					sets.push('flags:byAssignee:' + filters[type]);
					break;
				
				case 'targetUid':
					sets.push('flags:byTargetUid:' + filters[type]);
					break;

				case 'quick':
					switch (filters.quick) {
						case 'mine':
							sets.push('flags:byAssignee:' + uid);
							break;
					}
					break;
			}
		}
	}
	sets = sets.length ? sets : ['flags:datetime'];	// No filter default

	async.waterfall([
		function (next) {
			if (sets.length === 1) {
				db.getSortedSetRevRange(sets[0], 0, -1, next);
			} else {
				db.getSortedSetRevIntersect({sets: sets, start: 0, stop: -1, aggregate: 'MAX'}, next);
			}
		},
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

Flags.validate = function (payload, callback) {
	async.parallel({
		targetExists: async.apply(Flags.targetExists, payload.type, payload.id),
		target: async.apply(Flags.getTarget, payload.type, payload.id, payload.uid),
		reporter: async.apply(user.getUserData, payload.uid)
	}, function (err, data) {
		if (err) {
			return callback(err);
		}

		if (data.target.deleted) {
			return callback(new Error('[[error:post-deleted]]'));
		} else if (data.reporter.banned) {
			return callback(new Error('[[error:user-banned]]'));
		}

		switch (payload.type) {
			case 'post':
				async.parallel({
					privileges: async.apply(privileges.posts.get, [payload.id], payload.uid)
				}, function (err, subdata) {
					if (err) {
						return callback(err);
					}

					var minimumReputation = utils.isNumber(meta.config['privileges:flag']) ? parseInt(meta.config['privileges:flag'], 10) : 1;
					if (!subdata.privileges[0].isAdminOrMod && parseInt(data.reporter.reputation, 10) < minimumReputation) {
						return callback(new Error('[[error:not-enough-reputation-to-flag]]'));
					}

					callback();
				});
				break;
		} 
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
			user.getUsersFields(uids, ['username', 'userslug', 'picture'], function (err, users) {
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
	var targetUid;

	async.waterfall([
		function (next) {
			// Sanity checks
			async.parallel([
				async.apply(Flags.exists, type, id, uid),
				async.apply(Flags.targetExists, type, id),
				async.apply(Flags.getTargetUid, type, id)
			], function (err, checks) {
				if (err) {
					return next(err);
				}

				targetUid = checks[2] || null;

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
			var tasks = [
				async.apply(db.setObject.bind(db), 'flag:' + flagId, {
					flagId: flagId,
					type: type,
					targetId: id,
					description: reason,
					uid: uid,
					datetime: Date.now()
				}),
				async.apply(db.sortedSetAdd.bind(db), 'flags:datetime', Date.now(), flagId),	// by time, the default
				async.apply(db.sortedSetAdd.bind(db), 'flags:byReporter:' + uid, Date.now(), flagId),	// by reporter
				async.apply(db.sortedSetAdd.bind(db), 'flags:byType:' + type, Date.now(), flagId),	// by flag type
				async.apply(db.setObjectField.bind(db), 'flagHash:flagId', [type, id, uid].join(':'), flagId)	// save hash for existence checking
			];

			if (targetUid) {
				tasks.push(async.apply(db.sortedSetAdd.bind(db), 'flags:byTargetUid:' + targetUid, Date.now(), flagId));	// by target uid
			}
		
			async.parallel(tasks, function (err, data) {
				if (err) {
					return next(err);
				}

				Flags.update(flagId, uid, { "state": "open" });
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
		case 'topic':	// just an example...
			topics.exists(id, callback);
			break;
		
		case 'post':
			posts.exists(id, callback);
			break;
	}
};

Flags.getTargetUid = function (type, id, callback) {
	switch (type) {
		case 'post':
			posts.getPostField(id, 'uid', callback);
			break;
	}
};

Flags.update = function (flagId, uid, changeset, callback) {
	// Retrieve existing flag data to compare for history-saving purposes
	var fields = ['state', 'assignee'];
	var history = [];
	var tasks = [];
	var now = Date.now();

	async.waterfall([
		async.apply(db.getObjectFields.bind(db), 'flag:' + flagId, fields),
		function (current, next) {
			for (var prop in changeset) {
				if (changeset.hasOwnProperty(prop)) {
					if (current[prop] === changeset[prop]) {
						delete changeset[prop];
					} else {
						// Add tasks as necessary
						switch (prop) {
							case 'state':
								tasks.push(async.apply(db.sortedSetAdd.bind(db), 'flags:byState:' + changeset[prop], now, flagId));
								tasks.push(async.apply(db.sortedSetRemove.bind(db), 'flags:byState:' + current[prop], flagId));
								break;
							
							case 'assignee':
								tasks.push(async.apply(db.sortedSetAdd.bind(db), 'flags:byAssignee:' + changeset[prop], now, flagId));
								break;
						}

						// Append to history payload
						history.push(prop + ':' + changeset[prop]);
					}
				}
			}

			if (!Object.keys(changeset).length) {
				// No changes
				return next();
			}

			// Save new object to db (upsert)
			tasks.push(async.apply(db.setObject, 'flag:' + flagId, changeset));
			// Append history
			tasks.push(async.apply(Flags.appendHistory, flagId, uid, history));

			async.parallel(tasks, function (err, data) {
				return next(err);
			});
		}
	], callback);
};

Flags.getHistory = function (flagId, callback) {
	var history;
	var uids = [];
	async.waterfall([
		async.apply(db.getSortedSetRevRangeWithScores.bind(db), 'flag:' + flagId + ':history', 0, -1),
		function (_history, next) {
			history = _history.map(function (entry) {
				try {
					entry.value = JSON.parse(entry.value);
				} catch (e) {
					return callback(e);
				}

				uids.push(entry.value[0]);

				// Deserialise field object
				var fields = entry.value[1].map(function (field) {
					field = field.toString().split(':');

					switch (field[0]) {
						case 'state':
							field[1] = field[1] === undefined ? null : '[[flags:state-' + field[1] + ']]';
							break;

						default:
							field[1] = field[1] === undefined ? null : field[1];
							break;
					}
					return {
						"attribute": field[0],
						"value": field[1]
					};
				});

				return {
					uid: entry.value[0],
					fields: fields,
					datetime: entry.score,
					datetimeISO: new Date(entry.score).toISOString()
				};
			});

			user.getUsersFields(uids, ['username', 'userslug', 'picture'], next);
		}
	], function (err, users) {
		if (err) {
			return callback(err);
		}

		// Append user data to each history event
		history = history.map(function (event, idx) {
			event.user = users[idx];
			return event;
		});

		callback(null, history);
	});
};

Flags.appendHistory = function (flagId, uid, changeset, callback) {
	var payload;
	try {
		payload = JSON.stringify([uid, changeset, Date.now()]);
	} catch (e) {
		return callback(e);
	}

	db.sortedSetAdd('flag:' + flagId + ':history', Date.now(), payload, callback);
};

Flags.appendNote = function (flagId, uid, note, callback) {
	var payload;
	try {
		payload = JSON.stringify([uid, note]);
	} catch (e) {
		return callback(e);
	}

	async.waterfall([
		async.apply(db.sortedSetAdd, 'flag:' + flagId + ':notes', Date.now(), payload),
		async.apply(Flags.appendHistory, flagId, uid, ['notes'])
	], callback);
};

Flags.notify = function (flagObj, uid, callback) {
	// Notify administrators, mods, and other associated people
	switch (flagObj.type) {
		case 'post':
			async.parallel({
				post: function (next) {
					async.waterfall([
						async.apply(posts.getPostData, flagObj.targetId),
						async.apply(posts.parsePost)
					], next);
				},
				title: async.apply(topics.getTitleByPid, flagObj.targetId),
				admins: async.apply(groups.getMembers, 'administrators', 0, -1),
				globalMods: async.apply(groups.getMembers, 'Global Moderators', 0, -1),
				moderators: function (next) {
					async.waterfall([
						async.apply(posts.getCidByPid, flagObj.targetId),
						function (cid, next) {
							groups.getMembers('cid:' + cid + ':privileges:mods', 0, -1, next);
						}
					], next);
				}
			}, function (err, results) {
				if (err) {
					return callback(err);
				}

				var title = S(results.title).decodeHTMLEntities().s;
				var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

				notifications.create({
					bodyShort: '[[notifications:user_flagged_post_in, ' + flagObj.reporter.username + ', ' + titleEscaped + ']]',
					bodyLong: results.post.content,
					pid: flagObj.targetId,
					path: '/post/' + flagObj.targetId,
					nid: 'flag:post:' + flagObj.targetId + ':uid:' + uid,
					from: uid,
					mergeId: 'notifications:user_flagged_post_in|' + flagObj.targetId,
					topicTitle: results.title
				}, function (err, notification) {
					if (err || !notification) {
						return callback(err);
					}

					plugins.fireHook('action:post.flag', {post: results.post, reason: flagObj.description, flaggingUser: flagObj.reporter});
					notifications.push(notification, results.admins.concat(results.moderators).concat(results.globalMods), callback);
				});
			});
			break;
	}
};

module.exports = Flags;