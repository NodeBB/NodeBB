'use strict';

const _ = require('lodash');
const winston = require('winston');
const validator = require('validator');

const db = require('./database');
const user = require('./user');
const groups = require('./groups');
const meta = require('./meta');
const notifications = require('./notifications');
const analytics = require('./analytics');
const categories = require('./categories');
const topics = require('./topics');
const posts = require('./posts');
const privileges = require('./privileges');
const plugins = require('./plugins');
const utils = require('../public/src/utils');
const batch = require('./batch');

const Flags = module.exports;

Flags._constants = {
	states: ['open', 'wip', 'resolved', 'rejected'],
	state_class: {
		open: 'info',
		wip: 'warning',
		resolved: 'success',
		rejected: 'danger',
	},
};

Flags.init = async function () {
	// Query plugins for custom filter strategies and merge into core filter strategies
	function prepareSets(sets, orSets, prefix, value) {
		if (!Array.isArray(value)) {
			sets.push(prefix + value);
		} else if (value.length) {
			if (value.length === 1) {
				sets.push(prefix + value[0]);
			} else {
				orSets.push(value.map(x => prefix + x));
			}
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
						sets.push(`flags:byAssignee:${uid}`);
						break;

					case 'unresolved':
						prepareSets(sets, orSets, 'flags:byState:', ['open', 'wip']);
						break;
				}
			},
		},
		helpers: {
			prepareSets: prepareSets,
		},
	};

	try {
		const data = await plugins.hooks.fire('filter:flags.getFilters', hookData);
		Flags._filters = data.filters;
	} catch (err) {
		winston.error(`[flags/init] Could not retrieve filters\n${err.stack}`);
		Flags._filters = {};
	}
};

Flags.get = async function (flagId) {
	const [base, history, notes, reports] = await Promise.all([
		db.getObject(`flag:${flagId}`),
		Flags.getHistory(flagId),
		Flags.getNotes(flagId),
		Flags.getReports(flagId),
	]);
	if (!base) {
		return;
	}

	const flagObj = {
		state: 'open',
		assignee: null,
		...base,
		datetimeISO: utils.toISOString(base.datetime),
		target_readable: `${base.type.charAt(0).toUpperCase() + base.type.slice(1)} ${base.targetId}`,
		target: await Flags.getTarget(base.type, base.targetId, 0),
		history: history,
		notes: notes,
		reports: reports,
	};

	const data = await plugins.hooks.fire('filter:flags.get', {
		flag: flagObj,
	});
	return data.flag;
};

Flags.getCount = async function ({ uid, filters }) {
	filters = filters || {};
	const flagIds = await Flags.getFlagIdsWithFilters({ filters, uid });
	return flagIds.length;
};

Flags.getFlagIdsWithFilters = async function ({ filters, uid }) {
	let sets = [];
	const orSets = [];

	// Default filter
	filters.page = filters.hasOwnProperty('page') ? Math.abs(parseInt(filters.page, 10) || 1) : 1;
	filters.perPage = filters.hasOwnProperty('perPage') ? Math.abs(parseInt(filters.perPage, 10) || 20) : 20;

	for (const type of Object.keys(filters)) {
		if (Flags._filters.hasOwnProperty(type)) {
			Flags._filters[type](sets, orSets, filters[type], uid);
		} else {
			winston.warn(`[flags/list] No flag filter type found: ${type}`);
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
		let _flagIds = await Promise.all(orSets.map(async orSet => await db.getSortedSetRevUnion({ sets: orSet, start: 0, stop: -1, aggregate: 'MAX' })));

		// Each individual orSet is ANDed together to construct the final list of flagIds
		_flagIds = _.intersection(..._flagIds);

		// Merge with flagIds returned by sets
		if (sets.length) {
			// If flag ids are already present, return a subset of flags that are in both sets
			flagIds = _.intersection(flagIds, _flagIds);
		} else {
			// Otherwise, return all flags returned via orSets
			flagIds = _.union(flagIds, _flagIds);
		}
	}

	return flagIds;
};

Flags.list = async function (data) {
	const filters = data.filters || {};
	let flagIds = await Flags.getFlagIdsWithFilters({
		filters,
		uid: data.uid,
	});
	flagIds = await Flags.sort(flagIds, data.sort);

	// Create subset for parsing based on page number (n=20)
	const flagsPerPage = Math.abs(parseInt(filters.perPage, 10) || 1);
	const pageCount = Math.ceil(flagIds.length / flagsPerPage);
	flagIds = flagIds.slice((filters.page - 1) * flagsPerPage, filters.page * flagsPerPage);

	const reportCounts = await db.sortedSetsCard(flagIds.map(flagId => `flag:${flagId}:reports`));

	const flags = await Promise.all(flagIds.map(async (flagId, idx) => {
		let flagObj = await db.getObject(`flag:${flagId}`);
		flagObj = {
			state: 'open',
			assignee: null,
			heat: reportCounts[idx],
			...flagObj,
		};
		flagObj.labelClass = Flags._constants.state_class[flagObj.state];

		return Object.assign(flagObj, {
			target_readable: `${flagObj.type.charAt(0).toUpperCase() + flagObj.type.slice(1)} ${flagObj.targetId}`,
			datetimeISO: utils.toISOString(flagObj.datetime),
		});
	}));

	const payload = await plugins.hooks.fire('filter:flags.list', {
		flags: flags,
		page: filters.page,
		uid: data.uid,
	});

	return {
		flags: payload.flags,
		page: payload.page,
		pageCount: pageCount,
	};
};

Flags.sort = async function (flagIds, sort) {
	const filterPosts = async (flagIds) => {
		const keys = flagIds.map(id => `flag:${id}`);
		const types = await db.getObjectsFields(keys, ['type']);
		return flagIds.filter((id, idx) => types[idx].type === 'post');
	};

	switch (sort) {
		// 'newest' is not handled because that is default
		case 'oldest':
			flagIds = flagIds.reverse();
			break;

		case 'reports': {
			const keys = flagIds.map(id => `flag:${id}:reports`);
			const heat = await db.sortedSetsCard(keys);
			const mapped = heat.map((el, i) => ({
				index: i, heat: el,
			}));
			mapped.sort((a, b) => b.heat - a.heat);
			flagIds = mapped.map(obj => flagIds[obj.index]);
			break;
		}

		case 'upvotes':	// fall-through
		case 'downvotes':
		case 'replies': {
			flagIds = await filterPosts(flagIds);
			const keys = flagIds.map(id => `flag:${id}`);
			const pids = (await db.getObjectsFields(keys, ['targetId'])).map(obj => obj.targetId);
			const votes = (await posts.getPostsFields(pids, [sort])).map(obj => parseInt(obj[sort], 10) || 0);
			const sortRef = flagIds.reduce((memo, cur, idx) => {
				memo[cur] = votes[idx];
				return memo;
			}, {});

			flagIds = flagIds.sort((a, b) => sortRef[b] - sortRef[a]);
		}
	}

	return flagIds;
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

	// Disallow flagging of profiles/content of privileged users
	const [targetPrivileged, reporterPrivileged] = await Promise.all([
		user.isPrivileged(target.uid),
		user.isPrivileged(reporter.uid),
	]);
	if (targetPrivileged && !reporterPrivileged) {
		throw new Error('[[error:cant-flag-privileged]]');
	}

	if (payload.type === 'post') {
		const editable = await privileges.posts.canEdit(payload.id, payload.uid);
		if (!editable.flag && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
			throw new Error('[[error:not-enough-reputation-to-flag]]');
		}
	} else if (payload.type === 'user') {
		if (parseInt(payload.id, 10) === parseInt(payload.uid, 10)) {
			throw new Error('[[error:cant-flag-self]]');
		}
		const editable = await privileges.users.canEdit(payload.uid, payload.id);
		if (!editable && !meta.config['reputation:disabled'] && reporter.reputation < meta.config['min:rep:flag']) {
			throw new Error('[[error:not-enough-reputation-to-flag]]');
		}
	} else {
		throw new Error('[[error:invalid-data]]');
	}
};

Flags.getNotes = async function (flagId) {
	let notes = await db.getSortedSetRevRangeWithScores(`flag:${flagId}:notes`, 0, -1);
	notes = await modifyNotes(notes);
	return notes;
};

Flags.getNote = async function (flagId, datetime) {
	let notes = await db.getSortedSetRangeByScoreWithScores(`flag:${flagId}:notes`, 0, 1, datetime, datetime);
	if (!notes.length) {
		throw new Error('[[error:invalid-data]]');
	}

	notes = await modifyNotes(notes);
	return notes[0];
};

Flags.getFlagIdByTarget = async function (type, id) {
	let method;
	switch (type) {
		case 'post':
			method = posts.getPostField;
			break;

		case 'user':
			method = user.getUserField;
			break;

		default:
			throw new Error('[[error:invalid-data]]');
	}

	return await method(id, 'flagId');
};

async function modifyNotes(notes) {
	const uids = [];
	notes = notes.map((note) => {
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
	return notes.map((note, idx) => {
		note.user = userData[idx];
		note.content = validator.escape(note.content);
		return note;
	});
}

Flags.deleteNote = async function (flagId, datetime) {
	const note = await db.getSortedSetRangeByScore(`flag:${flagId}:notes`, 0, 1, datetime, datetime);
	if (!note.length) {
		throw new Error('[[error:invalid-data]]');
	}

	await db.sortedSetRemove(`flag:${flagId}:notes`, note[0]);
};

Flags.create = async function (type, id, uid, reason, timestamp) {
	let doHistoryAppend = false;
	if (!timestamp) {
		timestamp = Date.now();
		doHistoryAppend = true;
	}
	const [flagExists, targetExists,, targetFlagged, targetUid, targetCid] = await Promise.all([
		// Sanity checks
		Flags.exists(type, id, uid),
		Flags.targetExists(type, id),
		Flags.canFlag(type, id, uid),
		Flags.targetFlagged(type, id),

		// Extra data for zset insertion
		Flags.getTargetUid(type, id),
		Flags.getTargetCid(type, id),
	]);
	if (flagExists) {
		throw new Error(`[[error:${type}-already-flagged]]`);
	} else if (!targetExists) {
		throw new Error('[[error:invalid-data]]');
	}

	// If the flag already exists, just add the report
	if (targetFlagged) {
		const flagId = await Flags.getFlagIdByTarget(type, id);
		await Promise.all([
			Flags.addReport(flagId, type, id, uid, reason, timestamp),
			Flags.update(flagId, uid, { state: 'open' }),
		]);

		return await Flags.get(flagId);
	}

	const flagId = await db.incrObjectField('global', 'nextFlagId');
	const batched = [];

	batched.push(
		db.setObject(`flag:${flagId}`, {
			flagId: flagId,
			type: type,
			targetId: id,
			targetUid: targetUid,
			datetime: timestamp,
		}),
		Flags.addReport(flagId, type, id, uid, reason, timestamp),
		db.sortedSetAdd('flags:datetime', timestamp, flagId), // by time, the default
		db.sortedSetAdd(`flags:byType:${type}`, timestamp, flagId),	// by flag type
		db.sortedSetIncrBy('flags:byTarget', 1, [type, id].join(':')),	// by flag target (score is count)
		analytics.increment('flags') // some fancy analytics
	);

	if (targetUid) {
		batched.push(db.sortedSetAdd(`flags:byTargetUid:${targetUid}`, timestamp, flagId)); // by target uid
	}

	if (targetCid) {
		batched.push(db.sortedSetAdd(`flags:byCid:${targetCid}`, timestamp, flagId)); // by target cid
	}

	if (type === 'post') {
		batched.push(
			db.sortedSetAdd(`flags:byPid:${id}`, timestamp, flagId),	// by target pid
			posts.setPostField(id, 'flagId', flagId)
		);

		if (targetUid && parseInt(targetUid, 10) !== parseInt(uid, 10)) {
			batched.push(user.incrementUserFlagsBy(targetUid, 1));
		}
	} else if (type === 'user') {
		batched.push(user.setUserField(id, 'flagId', flagId));
	}

	// Run all the database calls in one single batched call...
	await Promise.all(batched);

	if (doHistoryAppend) {
		await Flags.update(flagId, uid, { state: 'open' });
	}

	const flagObj = await Flags.get(flagId);

	plugins.hooks.fire('action:flags.create', { flag: flagObj });
	return flagObj;
};

Flags.getReports = async function (flagId) {
	const payload = await db.getSortedSetRevRangeWithScores(`flag:${flagId}:reports`, 0, -1);
	const [reports, uids] = payload.reduce((memo, cur) => {
		const value = cur.value.split(';');
		memo[1].push(value.shift());
		cur.value = value.join(';');
		memo[0].push(cur);

		return memo;
	}, [[], []]);

	await Promise.all(reports.map(async (report, idx) => {
		report.timestamp = report.score;
		report.timestampISO = new Date(report.score).toISOString();
		delete report.score;
		report.reporter = await user.getUserFields(uids[idx], ['username', 'userslug', 'picture', 'reputation']);
	}));

	return reports;
};

Flags.addReport = async function (flagId, type, id, uid, reason, timestamp) {
	await db.sortedSetAddBulk([
		[`flags:byReporter:${uid}`, timestamp, flagId],
		[`flag:${flagId}:reports`, timestamp, [uid, reason].join(';')],

		['flags:hash', flagId, [type, id, uid].join(':')],
	]);

	plugins.hooks.fire('action:flags.addReport', { flagId, type, id, uid, reason, timestamp });
};

Flags.exists = async function (type, id, uid) {
	return await db.isSortedSetMember('flags:hash', [type, id, uid].join(':'));
};

Flags.canFlag = async function (type, id, uid) {
	const limit = meta.config['flags:limitPerTarget'];
	if (limit > 0) {
		const score = await db.sortedSetScore('flags:byTarget', `${type}:${id}`);
		if (score >= limit) {
			throw new Error(`[[error:${type}-flagged-too-many-times]]`);
		}
	}

	const canRead = await privileges.posts.can('topics:read', id, uid);
	switch (type) {
		case 'user':
			return true;

		case 'post':
			if (!canRead) {
				throw new Error('[[error:no-privileges]]');
			}
			break;

		default:
			throw new Error('[[error:invalid-data]]');
	}
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

Flags.targetFlagged = async function (type, id) {
	return await db.sortedSetScore('flags:byTarget', [type, id].join(':')) >= 1;
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

Flags.update = async function (flagId, uid, changeset) {
	const current = await db.getObjectFields(`flag:${flagId}`, ['uid', 'state', 'assignee', 'type', 'targetId']);
	if (!current.type) {
		return;
	}
	const now = changeset.datetime || Date.now();
	const notifyAssignee = async function (assigneeId) {
		if (assigneeId === '' || parseInt(uid, 10) === parseInt(assigneeId, 10)) {
			return;
		}
		const notifObj = await notifications.create({
			type: 'my-flags',
			bodyShort: `[[notifications:flag_assigned_to_you, ${flagId}]]`,
			bodyLong: '',
			path: `/flags/${flagId}`,
			nid: `flags:assign:${flagId}:uid:${assigneeId}`,
			from: uid,
		});
		await notifications.push(notifObj, [assigneeId]);
	};
	const isAssignable = async function (assigneeId) {
		let allowed = false;
		allowed = await user.isAdminOrGlobalMod(assigneeId);

		// Mods are also allowed to be assigned, if flag target is post in uid's moderated cid
		if (!allowed && current.type === 'post') {
			const cid = await posts.getCidByPid(current.targetId);
			allowed = await user.isModerator(assigneeId, cid);
		}

		return allowed;
	};

	// Retrieve existing flag data to compare for history-saving/reference purposes
	const tasks = [];
	for (const prop of Object.keys(changeset)) {
		if (current[prop] === changeset[prop]) {
			delete changeset[prop];
		} else if (prop === 'state') {
			if (!Flags._constants.states.includes(changeset[prop])) {
				delete changeset[prop];
			} else {
				tasks.push(db.sortedSetAdd(`flags:byState:${changeset[prop]}`, now, flagId));
				tasks.push(db.sortedSetRemove(`flags:byState:${current[prop]}`, flagId));
				if (changeset[prop] === 'resolved' || changeset[prop] === 'rejected') {
					tasks.push(notifications.rescind(`flag:${current.type}:${current.targetId}`));
				}
			}
		} else if (prop === 'assignee') {
			/* eslint-disable-next-line */
			if (!await isAssignable(parseInt(changeset[prop], 10))) {
				delete changeset[prop];
			} else {
				tasks.push(db.sortedSetAdd(`flags:byAssignee:${changeset[prop]}`, now, flagId));
				tasks.push(notifyAssignee(changeset[prop]));
			}
		}
	}

	if (!Object.keys(changeset).length) {
		return;
	}

	tasks.push(db.setObject(`flag:${flagId}`, changeset));
	tasks.push(Flags.appendHistory(flagId, uid, changeset));
	await Promise.all(tasks);

	plugins.hooks.fire('action:flags.update', { flagId: flagId, changeset: changeset, uid: uid });
};

Flags.resolveFlag = async function (type, id, uid) {
	const flagId = await Flags.getFlagIdByTarget(type, id);
	if (parseInt(flagId, 10)) {
		await Flags.update(flagId, uid, { state: 'resolved' });
	}
};

Flags.resolveUserPostFlags = async function (uid, callerUid) {
	if (meta.config['flags:autoResolveOnBan']) {
		await batch.processSortedSet(`uid:${uid}:posts`, async (pids) => {
			let postData = await posts.getPostsFields(pids, ['pid', 'flagId']);
			postData = postData.filter(p => p && p.flagId);
			for (const postObj of postData) {
				if (parseInt(postObj.flagId, 10)) {
					// eslint-disable-next-line no-await-in-loop
					await Flags.update(postObj.flagId, callerUid, { state: 'resolved' });
				}
			}
		}, {
			batch: 500,
		});
	}
};

Flags.getHistory = async function (flagId) {
	const uids = [];
	let history = await db.getSortedSetRevRangeWithScores(`flag:${flagId}:history`, 0, -1);
	const targetUid = await db.getObjectField(`flag:${flagId}`, 'targetUid');

	history = history.map((entry) => {
		entry.value = JSON.parse(entry.value);

		uids.push(entry.value[0]);

		// Deserialise changeset
		const changeset = entry.value[1];
		if (changeset.hasOwnProperty('state')) {
			changeset.state = changeset.state === undefined ? '' : `[[flags:state-${changeset.state}]]`;
		}

		return {
			uid: entry.value[0],
			fields: changeset,
			datetime: entry.score,
			datetimeISO: utils.toISOString(entry.score),
		};
	});

	// Append ban history and username change data
	history = await mergeBanHistory(history, targetUid, uids);
	history = await mergeUsernameEmailChanges(history, targetUid, uids);

	const userData = await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
	history.forEach((event, idx) => { event.user = userData[idx]; });

	// Resort by date
	history = history.sort((a, b) => b.datetime - a.datetime);

	return history;
};

Flags.appendHistory = async function (flagId, uid, changeset) {
	const datetime = changeset.datetime || Date.now();
	delete changeset.datetime;
	const payload = JSON.stringify([uid, changeset, datetime]);
	await db.sortedSetAdd(`flag:${flagId}:history`, datetime, payload);
};

Flags.appendNote = async function (flagId, uid, note, datetime) {
	if (datetime) {
		await Flags.deleteNote(flagId, datetime);
	}
	datetime = datetime || Date.now();

	const payload = JSON.stringify([uid, note]);
	await db.sortedSetAdd(`flag:${flagId}:notes`, datetime, payload);
	await Flags.appendHistory(flagId, uid, {
		notes: null,
		datetime: datetime,
	});
};

Flags.notify = async function (flagObj, uid) {
	const [admins, globalMods] = await Promise.all([
		groups.getMembers('administrators', 0, -1),
		groups.getMembers('Global Moderators', 0, -1),
	]);
	let uids = admins.concat(globalMods);
	let notifObj = null;
	if (flagObj.type === 'post') {
		const [title, cid] = await Promise.all([
			topics.getTitleByPid(flagObj.targetId),
			posts.getCidByPid(flagObj.targetId),
		]);

		const modUids = await categories.getModeratorUids([cid]);
		const titleEscaped = utils.decodeHTMLEntities(title).replace(/%/g, '&#37;').replace(/,/g, '&#44;');

		notifObj = await notifications.create({
			type: 'new-post-flag',
			bodyShort: `[[notifications:user_flagged_post_in, ${flagObj.reports[flagObj.reports.length - 1].reporter.username}, ${titleEscaped}]]`,
			bodyLong: await plugins.hooks.fire('filter:parse.raw', String(flagObj.description || '')),
			pid: flagObj.targetId,
			path: `/flags/${flagObj.flagId}`,
			nid: `flag:post:${flagObj.targetId}`,
			from: uid,
			mergeId: `notifications:user_flagged_post_in|${flagObj.targetId}`,
			topicTitle: title,
		});
		uids = uids.concat(modUids[0]);
	} else if (flagObj.type === 'user') {
		notifObj = await notifications.create({
			type: 'new-user-flag',
			bodyShort: `[[notifications:user_flagged_user, ${flagObj.reports[flagObj.reports.length - 1].reporter.username}, ${flagObj.target.username}]]`,
			bodyLong: await plugins.hooks.fire('filter:parse.raw', String(flagObj.description || '')),
			path: `/flags/${flagObj.flagId}`,
			nid: `flag:user:${flagObj.targetId}`,
			from: uid,
			mergeId: `notifications:user_flagged_user|${flagObj.targetId}`,
		});
	} else {
		throw new Error('[[error:invalid-data]]');
	}

	plugins.hooks.fire('action:flags.notify', {
		flag: flagObj,
		notification: notifObj,
		from: uid,
		to: uids,
	});
	uids = uids.filter(_uid => parseInt(_uid, 10) !== parseInt(uid, 10));
	await notifications.push(notifObj, uids);
};

async function mergeBanHistory(history, targetUid, uids) {
	let recentBans = await db.getSortedSetRevRange(`uid:${targetUid}:bans:timestamp`, 0, 19);
	recentBans = await db.getObjects(recentBans);

	return history.concat(recentBans.reduce((memo, cur) => {
		uids.push(cur.fromUid);
		memo.push({
			uid: cur.fromUid,
			meta: [
				{
					key: '[[user:banned]]',
					value: cur.reason,
					labelClass: 'danger',
				},
				{
					key: '[[user:info.banned-expiry]]',
					value: new Date(parseInt(cur.expire, 10)).toISOString(),
					labelClass: 'default',
				},
			],
			datetime: parseInt(cur.timestamp, 10),
			datetimeISO: utils.toISOString(parseInt(cur.timestamp, 10)),
		});

		return memo;
	}, []));
}

async function mergeUsernameEmailChanges(history, targetUid, uids) {
	const usernameChanges = await user.getHistory(`user:${targetUid}:usernames`);
	const emailChanges = await user.getHistory(`user:${targetUid}:emails`);

	return history.concat(usernameChanges.reduce((memo, changeObj) => {
		uids.push(targetUid);
		memo.push({
			uid: targetUid,
			meta: [
				{
					key: '[[user:change_username]]',
					value: changeObj.value,
					labelClass: 'primary',
				},
			],
			datetime: changeObj.timestamp,
			datetimeISO: changeObj.timestampISO,
		});

		return memo;
	}, [])).concat(emailChanges.reduce((memo, changeObj) => {
		uids.push(targetUid);
		memo.push({
			uid: targetUid,
			meta: [
				{
					key: '[[user:change_email]]',
					value: changeObj.value,
					labelClass: 'primary',
				},
			],
			datetime: changeObj.timestamp,
			datetimeISO: changeObj.timestampISO,
		});

		return memo;
	}, []));
}

require('./promisify')(Flags);
