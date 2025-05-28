'use strict';

/**
 * DEVELOPMENT NOTE
 *
 * THIS FILE IS UNDER ACTIVE DEVELOPMENT AND IS EXPLICITLY EXCLUDED FROM IMMUTABILITY GUARANTEES
 *
 * If you use api methods in this file, be prepared that they may be removed or modified with no warning.
 */

const nconf = require('nconf');
const winston = require('winston');

const db = require('../database');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const posts = require('../posts');
const topics = require('../topics');
const messaging = require('../messaging');
const utils = require('../utils');

const activitypubApi = module.exports;

function enabledCheck(next) {
	return async function (caller, params) {
		if (meta.config.activitypubEnabled) {
			try {
				await next(caller, params);
			} catch (e) {
				winston.error(`[activitypub/api] Error\n${e.stack}`);
			}
		}
	};
}

activitypubApi.follow = enabledCheck(async (caller, { type, id, actor } = {}) => {
	// Privilege checks should be done upstream
	const acceptedTypes = ['uid', 'cid'];
	const assertion = await activitypub.actors.assert(actor);
	if (!acceptedTypes.includes(type) || !assertion || (Array.isArray(assertion) && assertion.length)) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (actor.includes('@')) {
		const [uid, cid] = await Promise.all([
			user.getUidByUserslug(actor),
			categories.getCidByHandle(actor),
		]);

		actor = uid || cid;
	}

	const isFollowing = await db.isSortedSetMember(type === 'uid' ? `followingRemote:${id}` : `cid:${id}:following`, actor);
	if (isFollowing) { // already following
		return;
	}

	const timestamp = Date.now();

	await db.sortedSetAdd(`followRequests:${type}.${id}`, timestamp, actor);
	try {
		await activitypub.send(type, id, [actor], {
			id: `${nconf.get('url')}/${type}/${id}#activity/follow/${encodeURIComponent(actor)}/${timestamp}`,
			type: 'Follow',
			object: actor,
		});
	} catch (e) {
		await db.sortedSetRemove(`followRequests:${type}.${id}`, actor);
		throw e;
	}
});

// should be .undo.follow
activitypubApi.unfollow = enabledCheck(async (caller, { type, id, actor }) => {
	const acceptedTypes = ['uid', 'cid'];
	const assertion = await activitypub.actors.assert(actor);
	if (!acceptedTypes.includes(type) || !assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (actor.includes('@')) {
		const [uid, cid] = await Promise.all([
			user.getUidByUserslug(actor),
			categories.getCidByHandle(actor),
		]);

		actor = uid || cid;
	}

	const [isFollowing, isPending] = await Promise.all([
		db.isSortedSetMember(type === 'uid' ? `followingRemote:${id}` : `cid:${id}:following`, actor),
		db.isSortedSetMember(`followRequests:${type === 'uid' ? 'uid' : 'cid'}.${id}`, actor),
	]);

	if (!isFollowing && !isPending) { // already not following/pending
		return;
	}

	const timestamps = await db.sortedSetsScore([
		`followRequests:${type}.${id}`,
		type === 'uid' ? `followingRemote:${id}` : `cid:${id}:following`,
	], actor);
	const timestamp = timestamps[0] || timestamps[1];

	const object = {
		id: `${nconf.get('url')}/${type}/${id}#activity/follow/${encodeURIComponent(actor)}/${timestamp}`,
		type: 'Follow',
		object: actor,
	};
	if (type === 'uid') {
		object.actor = `${nconf.get('url')}/uid/${id}`;
	} else if (type === 'cid') {
		object.actor = `${nconf.get('url')}/category/${id}`;
	}

	await activitypub.send(type, id, [actor], {
		id: `${nconf.get('url')}/${type}/${id}#activity/undo:follow/${encodeURIComponent(actor)}/${timestamp}`,
		type: 'Undo',
		actor: object.actor,
		object,
	});

	if (type === 'uid') {
		await Promise.all([
			db.sortedSetRemove(`followingRemote:${id}`, actor),
			db.sortedSetRemove(`followRequests:uid.${id}`, actor),
			db.sortedSetRemove(`followersRemote:${actor}`, id),
			db.decrObjectField(`user:${id}`, 'followingRemoteCount'),
		]);
	} else if (type === 'cid') {
		await Promise.all([
			db.sortedSetRemove(`cid:${id}:following`, actor),
			db.sortedSetRemove(`followRequests:cid.${id}`, actor),
			db.sortedSetRemove(`followersRemote:${actor}`, `cid|${id}`),
		]);
	}
});

activitypubApi.create = {};

activitypubApi.create.note = enabledCheck(async (caller, { pid, post }) => {
	if (!post) {
		post = (await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false })).pop();
		if (!post) {
			return;
		}
	} else {
		pid = post.pid;
	}

	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating creation of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { activity, targets } = await activitypub.mocks.activities.create(pid, caller.uid, post);

	await Promise.all([
		activitypub.send('uid', caller.uid, Array.from(targets), activity),
		activitypub.feps.announce(pid, activity),
		// utils.isNumber(post.cid) ? activitypubApi.add(caller, { pid }) : undefined,
	]);
});

activitypubApi.create.privateNote = enabledCheck(async (caller, { messageObj }) => {
	const { roomId } = messageObj;
	let targets = await messaging.getUidsInRoom(roomId, 0, -1);
	targets = targets.filter(uid => !utils.isNumber(uid)); // remote uids only

	const object = await activitypub.mocks.notes.private({ messageObj });

	const payload = {
		id: `${object.id}#activity/create/${Date.now()}`,
		type: 'Create',
		actor: object.attributedTo,
		to: object.to,
		object,
	};

	await activitypub.send('uid', messageObj.fromuid, targets, payload);
});

activitypubApi.update = {};

activitypubApi.update.profile = enabledCheck(async (caller, { uid }) => {
	const [object, targets] = await Promise.all([
		activitypub.mocks.actors.user(uid),
		db.getSortedSetMembers(`followersRemote:${caller.uid}`),
	]);

	await activitypub.send('uid', caller.uid, targets, {
		id: `${object.id}#activity/update/${Date.now()}`,
		type: 'Update',
		actor: object.id,
		to: [activitypub._constants.publicAddress],
		cc: [],
		object,
	});
});

activitypubApi.update.category = enabledCheck(async (caller, { cid }) => {
	const [object, targets] = await Promise.all([
		activitypub.mocks.actors.category(cid),
		activitypub.notes.getCategoryFollowers(cid),
	]);

	await activitypub.send('cid', cid, targets, {
		id: `${object.id}#activity/update/${Date.now()}`,
		type: 'Update',
		actor: object.id,
		to: [activitypub._constants.publicAddress],
		cc: [],
		object,
	});
});

activitypubApi.update.note = enabledCheck(async (caller, { post }) => {
	// Only applies to local posts
	if (!utils.isNumber(post.pid)) {
		return;
	}

	const object = await activitypub.mocks.notes.public(post);
	const { to, cc, targets } = await activitypub.buildRecipients(object, { pid: post.pid, uid: post.user.uid });
	object.to = to;
	object.cc = cc;

	const allowed = await privileges.posts.can('topics:read', post.pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating update of pid ${post.pid} to the fediverse due to privileges.`);
		return;
	}

	const payload = {
		id: `${object.id}#activity/update/${post.edited || Date.now()}`,
		type: 'Update',
		actor: object.attributedTo,
		to,
		cc,
		object,
	};

	await Promise.all([
		activitypub.send('uid', caller.uid, Array.from(targets), payload),
		activitypub.feps.announce(post.pid, payload),
	]);
});

activitypubApi.update.privateNote = enabledCheck(async (caller, { messageObj }) => {
	if (!utils.isNumber(messageObj.mid)) {
		return;
	}

	const { roomId } = messageObj;
	let uids = await messaging.getUidsInRoom(roomId, 0, -1);
	uids = uids.filter(uid => String(uid) !== String(messageObj.fromuid)); // no author
	const to = uids.map(uid => (utils.isNumber(uid) ? `${nconf.get('url')}/uid/${uid}` : uid));
	const targets = uids.filter(uid => !utils.isNumber(uid)); // remote uids only

	const object = await activitypub.mocks.notes.private({ messageObj });

	const payload = {
		id: `${object.id}#activity/create/${Date.now()}`,
		type: 'Update',
		actor: object.attributedTo,
		to,
		object,
	};

	await activitypub.send('uid', caller.uid, targets, payload);
});

activitypubApi.delete = {};

activitypubApi.delete.note = enabledCheck(async (caller, { pid }) => {
	// Only applies to local posts
	if (!utils.isNumber(pid)) {
		return;
	}

	const id = `${nconf.get('url')}/post/${pid}`;
	const post = (await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false })).pop();
	const object = await activitypub.mocks.notes.public(post);
	const { to, cc, targets } = await activitypub.buildRecipients(object, { pid, uid: post.user.uid });

	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating update of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const payload = {
		id: `${id}#activity/delete/${Date.now()}`,
		type: 'Delete',
		actor: object.attributedTo,
		to,
		cc,
		object: id,
		origin: object.context,
	};

	await Promise.all([
		activitypub.send('uid', caller.uid, Array.from(targets), payload),
		activitypub.feps.announce(pid, payload),
	]);
});

activitypubApi.like = {};

activitypubApi.like.note = enabledCheck(async (caller, { pid }) => {
	const payload = {
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/like/${encodeURIComponent(pid)}`,
		type: 'Like',
		actor: `${nconf.get('url')}/uid/${caller.uid}`,
		object: utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid,
	};

	if (!activitypub.helpers.isUri(pid)) { // only 1b12 announce for local likes
		await activitypub.feps.announce(pid, payload);
		return;
	}

	const uid = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(uid)) {
		return;
	}

	await Promise.all([
		activitypub.send('uid', caller.uid, [uid], payload),
		activitypub.feps.announce(pid, payload),
	]);
});

activitypubApi.announce = {};

activitypubApi.announce.note = enabledCheck(async (caller, { tid }) => {
	const { mainPid: pid, cid } = await topics.getTopicFields(tid, ['mainPid', 'cid']);

	// Only remote posts can be announced to real categories
	if (utils.isNumber(pid) || parseInt(cid, 10) === -1) {
		return;
	}

	const uid = await posts.getPostField(pid, 'uid'); // author
	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating announce of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await activitypub.buildRecipients({
		id: pid,
		to: [activitypub._constants.publicAddress],
		cc: [`${nconf.get('url')}/uid/${caller.uid}/followers`, uid],
	}, { uid: caller.uid });

	await activitypub.send('uid', caller.uid, Array.from(targets), {
		id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/${Date.now()}`,
		type: 'Announce',
		actor: `${nconf.get('url')}/uid/${caller.uid}`,
		to,
		cc,
		object: pid,
		target: `${nconf.get('url')}/category/${cid}`,
	});
});

activitypubApi.undo = {};

// activitypubApi.undo.follow =

activitypubApi.undo.like = enabledCheck(async (caller, { pid }) => {
	if (!activitypub.helpers.isUri(pid)) {
		return;
	}

	const uid = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(uid)) {
		return;
	}

	const payload = {
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/undo:like/${encodeURIComponent(pid)}/${Date.now()}`,
		type: 'Undo',
		actor: `${nconf.get('url')}/uid/${caller.uid}`,
		object: {
			actor: `${nconf.get('url')}/uid/${caller.uid}`,
			id: `${nconf.get('url')}/uid/${caller.uid}#activity/like/${encodeURIComponent(pid)}`,
			type: 'Like',
			object: pid,
		},
	};

	await Promise.all([
		activitypub.send('uid', caller.uid, [uid], payload),
		activitypub.feps.announce(pid, payload),
	]);
});

activitypubApi.flag = enabledCheck(async (caller, flag) => {
	if (!activitypub.helpers.isUri(flag.targetId)) {
		return;
	}
	const reportedIds = [flag.targetId];
	if (flag.type === 'post' && activitypub.helpers.isUri(flag.targetUid)) {
		reportedIds.push(flag.targetUid);
	}
	const reason = flag.reason ||
		(flag.reports && flag.reports.filter(report => report.reporter.uid === caller.uid).at(-1).value);
	await activitypub.send('uid', caller.uid, reportedIds, {
		id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/flag/${caller.uid}`,
		type: 'Flag',
		actor: `${nconf.get('url')}/uid/${caller.uid}`,
		object: reportedIds,
		content: reason,
	});
	await db.sortedSetAdd(`flag:${flag.flagId}:remote`, Date.now(), caller.uid);
});

/*
activitypubApi.add = enabledCheck((async (_, { pid }) => {
	let localId;
	if (String(pid).startsWith(nconf.get('url'))) {
		({ id: localId } = await activitypub.helpers.resolveLocalId(pid));
	}

	const tid = await posts.getPostField(localId || pid, 'tid');
	const cid = await posts.getCidByPid(localId || pid);
	if (!utils.isNumber(tid) || cid <= 0) { // `Add` only federated on categorized topics started locally
		return;
	}

	let to = [activitypub._constants.publicAddress];
	let cc = [];
	let targets;
	({ to, cc, targets } = await activitypub.buildRecipients({ to, cc }, { pid: localId || pid, cid }));

	await activitypub.send('cid', cid, Array.from(targets), {
		id: `${nconf.get('url')}/post/${encodeURIComponent(localId || pid)}#activity/add/${Date.now()}`,
		type: 'Add',
		to,
		cc,
		object: utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid,
		target: `${nconf.get('url')}/topic/${tid}`,
	});
}));
*/
activitypubApi.undo.flag = enabledCheck(async (caller, flag) => {
	if (!activitypub.helpers.isUri(flag.targetId)) {
		return;
	}
	const reportedIds = [flag.targetId];
	if (flag.type === 'post' && activitypub.helpers.isUri(flag.targetUid)) {
		reportedIds.push(flag.targetUid);
	}
	const reason = flag.reason ||
		(flag.reports && flag.reports.filter(report => report.reporter.uid === caller.uid).at(-1).value);
	await activitypub.send('uid', caller.uid, reportedIds, {
		id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/undo:flag/${caller.uid}/${Date.now()}`,
		type: 'Undo',
		actor: `${nconf.get('url')}/uid/${caller.uid}`,
		object: {
			id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/flag/${caller.uid}`,
			actor: `${nconf.get('url')}/uid/${caller.uid}`,
			type: 'Flag',
			object: reportedIds,
			content: reason,
		},
	});
	await db.sortedSetRemove(`flag:${flag.flagId}:remote`, caller.uid);
});
