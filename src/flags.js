'use strict';

const async = require('async');
const _ = require('lodash');
const winston = require('winston');
const validator = require('validator');

const db = require('./database');
const user = require('./user');
const groups = require('./groups');
const meta = require('./meta');
const notifications = require('./notifications');
const analytics = require('./analytics');
const topics = require('./topics');
const posts = require('./posts');
const privileges = require('./privileges');
const plugins = require('./plugins');
const utils = require('../public/src/utils');

const Flags = module.exports;

Flags.init = async function () {
	// Query plugins for custom filter strategies and merge into core filter strategies
	function prepareSets(sets, orSets, prefix, value) {
		if (!Array.isArray(value)) {
			sets.push(prefix + value);
		} else if (value.length) {
			value.forEach(x => orSets.push(prefix + x));
		}
	}

	const hookData = {
		filters: {
			type: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byType:', key);
			},
			state: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byState:', key);
			},
			reporterId: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byReporter:', key);
			},
			assignee: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byAssignee:', key);
			},
			targetUid: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byTargetUid:', key);
			},
			cid: function (sets, orSets, key) {
				prepareSets(sets, orSets, 'flags:byCid:', key);
			},
			page: function () {	/* noop */ },
			perPage: function () {	/* noop */ },
			quick: function (sets, orSets, key, uid) {
				switch (key) {
				case 'mine':
					sets.push('flags:byAssignee:' + uid);
					break;
				}
			},
		},
		helpers: {
			prepareSets: prepareSets,
		},
	};

	try {
		const data = await plugins.fireHook('filter:flags.getFilters', hookData);
		Flags._filters = data.filters;
	} catch (err) {
		winston.error('[flags/init] Could not retrieve filters', err);
		Flags._filters = {};
	}
};

Flags.get = async function (flagId) {
	const [base, history, notes] = await Promise.all([
		db.getObject('flag:' + flagId),
		Flags.getHistory(flagId),
		Flags.getNotes(flagId),
	]);
	if (!base) {
		return;
	}

	const [userObj, targetObj] = await Promise.all([
		user.getUserFields(base.uid, ['username', 'userslug', 'picture', 'reputation']),
		Flags.getTarget(base.type, base.targetId, 0),
	]);

	const flagObj = {
		state: 'open',
		...base,
		description: validator.escape(base.description),
		datetimeISO: utils.toISOString(base.datetime),
		target_readable: base.type.charAt(0).toUpperCase() + base.type.slice(1) + ' ' + base.targetId,
		target: targetObj,
		history: history,
		notes: notes,
		reporter: userObj,
	};
	const data = await plugins.fireHook('filter:flags.get', {
		flag: flagObj,
	});
	return data.flag;
};

Flags.list = async function (filters, uid) {
	filters = filters || {};

	let sets = [];
	const orSets = [];

	// Default filter
	filters.page = filters.hasOwnProperty('page') ? Math.abs(parseInt(filters.page, 10) || 1) : 1;
	filters.perPage = filters.hasOwnProperty('perPage') ? Math.abs(parseInt(filters.perPage, 10) || 20) : 20;

	for (var type in filters) {
		if (filters.hasOwnProperty(type)) {
			if (Flags._filters.hasOwnProperty(type)) {
				Flags._filters[type](sets, orSets, filters[type], uid);
			} else {
				winston.warn('[flags/list] No flag filter type found: ' + type);
			}
		}
	}
	sets = (sets.length || orSets.length) ? sets : ['flags:datetime'];	// No filter default

	let flagIds = [];
	if (sets.length === 1) {
		flagIds = await db.getSortedSetRevRange(sets[0], 0, -1);
	} else if (sets.length > 1) {
		flagIds = await db.getSortedSetRevIntersect({ sets: sets, start: 0, stop: -1, aggregate: 'MAX' });
	}

	if (orSets.length) {
		const _flagIds = await db.getSortedSetRevUnion({ sets: orSets, start: 0, stop: -1, aggregate: 'MAX' });
		if (sets.length) {
			// If flag ids are already present, return a subset of flags that are in both sets
			flagIds = _.intersection(flagIds, _flagIds);
		} else {
			// Otherwise, return all flags returned via orSets
			flagIds = _.union(flagIds, _flagIds);
		}
	}

	// Create subset for parsing based on page number (n=20)
	const flagsPerPage = Math.abs(parseInt(filters.perPage, 10) || 1);
	const pageCount = Math.ceil(flagIds.length / flagsPerPage);
	flagIds = flagIds.slice((filters.page - 1) * flagsPerPage, filters.page * flagsPerPage);

	const flags = await Promise.all(flagIds.map(async (flagId) => {
		let flagObj = await db.getObject('flag:' + flagId);
		const userObj = await user.getUserFields(flagObj.uid, ['username', 'picture']);
		flagObj = {
			state: 'open',
			...flagObj,
			reporter: {
				username: userObj.username,
				picture: userObj.picture,
				'icon:bgColor': userObj['icon:bgColor'],
				'icon:text': userObj['icon:text'],
			},
		};
		const stateToLabel = {
			open: 'info',
			wip: 'warning',
			resolved: 'success',
			rejected: 'danger',
		};
		flagObj.labelClass = stateToLabel[flagObj.state];

		return Object.assign(flagObj, {
			description: validator.escape(String(flagObj.description)),
			target_readable: flagObj.type.charAt(0).toUpperCase() + flagObj.type.slice(1) + ' ' + flagObj.targetId,
			datetimeISO: utils.toISOString(flagObj.datetime),
		});
	}));

	const data = await plugins.fireHook('filter:flags.list', {
		flags: flags,
		page: filters.page,
	});

	return {
		flags: data.flags,
		page: data.page,
		pageCount: pageCount,
	};
};

Flags.validate = async function (payload) {
	const [target, reporter] = await Promise.all([
		Flags.getTarget(payload.type, payload.id, payload.uid),
		user.getUserData(payload.uid),
	]);

	if (!target) {
		throw new Error('[[error:invalid-data]]');
	} else if (target.deleted) {
		throw new Error('[[error:post-deleted]]');
	} else if (!reporter || !reporter.userslug) {
		throw new Error('[[error:no-user]]');
	} else if (reporter.banned) {
		throw new Error('[[error:user-banned]]');
	}

	if (payload.type === 'post') {
		const editable = await privileges.posts.canEdit(payload.id, payload.uid);
		if (!editable.flag && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
			throw new Error('[[error:not-enough-reputation-to-flag]]');
		}
	} else if (payload.type === 'user') {
		const editable = await privileges.users.canEdit(payload.uid, payload.id);
		if (!editable && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
			throw new Error('[[error:not-enough-reputation-to-flag]]');
		}
	} else {
		throw new Error('[[error:invalid-data]]');
	}
};

Flags.getNotes = async function (flagId) {
	let notes = await db.getSortedSetRevRangeWithScores('flag:' + flagId + ':notes', 0, -1);
	const uids = [];
	notes = notes.map(function (note) {
		const noteObj = JSON.parse(note.value);
		uids.push(noteObj[0]);
		return {
			uid: noteObj[0],
			content: noteObj[1],
			datetime: note.score,
			datetimeISO: utils.toISOString(note.score),
		};
	});
	const userData = await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
	return notes.map(function (note, idx) {
		note.user = userData[idx];
		note.content = validator.escape(note.content);
		return note;
	});
};

Flags.create = async function (type, id, uid, reason, timestamp) {
	let doHistoryAppend = false;
	if (!timestamp) {
		timestamp = Date.now();
		doHistoryAppend = true;
	}
	const [exists, targetExists, targetUid, targetCid] = await Promise.all([
		// Sanity checks
		Flags.exists(type, id, uid),
		Flags.targetExists(type, id),
		// Extra data for zset insertion
		Flags.getTargetUid(type, id),
		Flags.getTargetCid(type, id),
	]);
	if (exists) {
		throw new Error('[[error:already-flagged]]');
	} else if (!targetExists) {
		throw new Error('[[error:invalid-data]]');
	}
	const flagId = await db.incrObjectField('global', 'nextFlagId');

	await db.setObject('flag:' + flagId, {
		flagId: flagId,
		type: type,
		targetId: id,
		description: reason,
		uid: uid,
		datetime: timestamp,
	});
	await db.sortedSetAdd('flags:datetime', timestamp, flagId); // by time, the default
	await db.sortedSetAdd('flags:byReporter:' + uid, timestamp, flagId); // by reporter
	await db.sortedSetAdd('flags:byType:' + type, timestamp, flagId);	// by flag type
	await db.sortedSetAdd('flags:hash', flagId, [type, id, uid].join(':')); // save zset for duplicate checking
	await analytics.increment('flags'); // some fancy analytics

	if (targetUid) {
		await db.sortedSetAdd('flags:byTargetUid:' + targetUid, timestamp, flagId); // by target uid
	}

	if (targetCid) {
		await db.sortedSetAdd('flags:byCid:' + targetCid, timestamp, flagId); // by target cid
	}

	if (type === 'post') {
		await db.sortedSetAdd('flags:byPid:' + id, timestamp, flagId);	// by target pid
		if (targetUid) {
			await db.sortedSetIncrBy('users:flags', 1, targetUid);
			await user.incrementUserFieldBy(targetUid, 'flags', 1);
		}
	}

	if (doHistoryAppend) {
		await Flags.update(flagId, uid, { state: 'open' });
	}

	return await Flags.get(flagId);
};

Flags.exists = async function (type, id, uid) {
	return await db.isSortedSetMember('flags:hash', [type, id, uid].join(':'));
};

Flags.getTarget = async function (type, id, uid) {
	if (type === 'user') {
		const userData = await user.getUserData(id);
		return userData && userData.uid ? userData : {};
	}
	if (type === 'post') {
		let postData = await posts.getPostData(id);
		if (!postData) {
			return {};
		}
		postData = await posts.parsePost(postData);
		postData = await topics.addPostData([postData], uid);
		return postData[0];
	}
	throw new Error('[[error:invalid-data]]');
};

Flags.targetExists = async function (type, id) {
	if (type === 'post') {
		return await posts.exists(id);
	} else if (type === 'user') {
		return await user.exists(id);
	}
	throw new Error('[[error:invalid-data]]');
};

Flags.getTargetUid = async function (type, id) {
	if (type === 'post') {
		return await posts.getPostField(id, 'uid');
	}
	return id;
};

Flags.getTargetCid = async function (type, id) {
	if (type === 'post') {
		return await posts.getCidByPid(id);
	}
	return null;
};

Flags.update = function (flagId, uid, changeset, callback) {
	// Retrieve existing flag data to compare for history-saving purposes
	var fields = ['state', 'assignee'];
	var tasks = [];
	var now = changeset.datetime || Date.now();
	var notifyAssignee = function (assigneeId, next) {
		if (assigneeId === '' || parseInt(uid, 10) === parseInt(assigneeId, 10)) {
			// Do nothing
			return next();
		}
		// Notify assignee of this update
		notifications.create({
			type: 'my-flags',
			bodyShort: '[[notifications:flag_assigned_to_you, ' + flagId + ']]',
			bodyLong: '',
			path: '/flags/' + flagId,
			nid: 'flags:assign:' + flagId + ':uid:' + assigneeId,
			from: uid,
		}, function (err, notification) {
			if (err || !notification) {
				return next(err);
			}

			notifications.push(notification, [assigneeId], next);
		});
	};

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
							tasks.push(async.apply(notifyAssignee, changeset[prop]));
							break;
						}
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
			tasks.push(async.apply(Flags.appendHistory, flagId, uid, changeset));

			// Fire plugin hook
			tasks.push(async.apply(plugins.fireHook, 'action:flags.update', { flagId: flagId, changeset: changeset, uid: uid }));

			async.parallel(tasks, function (err) {
				return next(err);
			});
		},
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

				// Deserialise changeset
				var changeset = entry.value[1];
				if (changeset.hasOwnProperty('state')) {
					changeset.state = changeset.state === undefined ? '' : '[[flags:state-' + changeset.state + ']]';
				}

				return {
					uid: entry.value[0],
					fields: changeset,
					datetime: entry.score,
					datetimeISO: utils.toISOString(entry.score),
				};
			});

			user.getUsersFields(uids, ['username', 'userslug', 'picture'], next);
		},
		function (users, next) {
			// Append user data to each history event
			history = history.map(function (event, idx) {
				event.user = users[idx];
				return event;
			});

			next(null, history);
		},
	], callback);
};

Flags.appendHistory = function (flagId, uid, changeset, callback) {
	var payload;
	var datetime = changeset.datetime || Date.now();
	delete changeset.datetime;

	try {
		payload = JSON.stringify([uid, changeset, datetime]);
	} catch (e) {
		return callback(e);
	}

	db.sortedSetAdd('flag:' + flagId + ':history', datetime, payload, callback);
};

Flags.appendNote = function (flagId, uid, note, datetime, callback) {
	if (typeof datetime === 'function' && !callback) {
		callback = datetime;
		datetime = Date.now();
	}

	var payload;
	try {
		payload = JSON.stringify([uid, note]);
	} catch (e) {
		return callback(e);
	}

	async.waterfall([
		async.apply(db.sortedSetAdd, 'flag:' + flagId + ':notes', datetime, payload),
		async.apply(Flags.appendHistory, flagId, uid, {
			notes: null,
			datetime: datetime,
		}),
	], callback);
};

Flags.notify = function (flagObj, uid, callback) {
	// Notify administrators, mods, and other associated people
	if (!callback) {
		callback = function () {};
	}

	switch (flagObj.type) {
	case 'post':
		async.parallel({
			post: function (next) {
				async.waterfall([
					async.apply(posts.getPostData, flagObj.targetId),
					async.apply(posts.parsePost),
				], next);
			},
			title: async.apply(topics.getTitleByPid, flagObj.targetId),
			admins: async.apply(groups.getMembers, 'administrators', 0, -1),
			globalMods: async.apply(groups.getMembers, 'Global Moderators', 0, -1),
			moderators: function (next) {
				var cid;
				async.waterfall([
					async.apply(posts.getCidByPid, flagObj.targetId),
					function (_cid, next) {
						cid = _cid;
						groups.getMembers('cid:' + cid + ':privileges:groups:moderate', 0, -1, next);
					},
					function (moderatorGroups, next) {
						groups.getMembersOfGroups(moderatorGroups.concat(['cid:' + cid + ':privileges:moderate']), next);
					},
					function (members, next) {
						next(null, _.flatten(members));
					},
				], next);
			},
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			var title = utils.decodeHTMLEntities(results.title);
			var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

			notifications.create({
				type: 'new-post-flag',
				bodyShort: '[[notifications:user_flagged_post_in, ' + flagObj.reporter.username + ', ' + titleEscaped + ']]',
				bodyLong: flagObj.description,
				pid: flagObj.targetId,
				path: '/flags/' + flagObj.flagId,
				nid: 'flag:post:' + flagObj.targetId + ':uid:' + uid,
				from: uid,
				mergeId: 'notifications:user_flagged_post_in|' + flagObj.targetId,
				topicTitle: results.title,
			}, function (err, notification) {
				if (err || !notification) {
					return callback(err);
				}

				plugins.fireHook('action:flags.create', {
					flag: flagObj,
				});

				var uids = results.admins.concat(results.moderators).concat(results.globalMods);
				uids = uids.filter(function (_uid) {
					return parseInt(_uid, 10) !== parseInt(uid, 10);
				});

				notifications.push(notification, uids, callback);
			});
		});
		break;

	case 'user':
		async.parallel({
			admins: async.apply(groups.getMembers, 'administrators', 0, -1),
			globalMods: async.apply(groups.getMembers, 'Global Moderators', 0, -1),
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			notifications.create({
				type: 'new-user-flag',
				bodyShort: '[[notifications:user_flagged_user, ' + flagObj.reporter.username + ', ' + flagObj.target.username + ']]',
				bodyLong: flagObj.description,
				path: '/flags/' + flagObj.flagId,
				nid: 'flag:user:' + flagObj.targetId + ':uid:' + uid,
				from: uid,
				mergeId: 'notifications:user_flagged_user|' + flagObj.targetId,
			}, function (err, notification) {
				if (err || !notification) {
					return callback(err);
				}

				plugins.fireHook('action:flag.create', {
					flag: flagObj,
				});	// delete @ NodeBB v1.6.0
				plugins.fireHook('action:flags.create', {
					flag: flagObj,
				});
				notifications.push(notification, results.admins.concat(results.globalMods), callback);
			});
		});
		break;

	default:
		callback(new Error('[[error:invalid-data]]'));
		break;
	}
};

require('./promisify')(Flags);
