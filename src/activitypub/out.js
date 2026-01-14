'use strict';

/**
 * This method deals unilaterally with federating activities outward.
 * There _shouldn't_ be any activities sent out that don't go through this file
 * This _should_ be the only file that calls activitypub.send()
 *
 * YMMV.
 */

const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const privileges = require('../privileges');
const topics = require('../topics');
const posts = require('../posts');
const messaging = require('../messaging');
const utils = require('../utils');
const activitypub = module.parent.exports;

const Out = module.exports;

function enabledCheck(next) {
	return async function (...args) {
		if (meta.config.activitypubEnabled) {
			try {
				await next.apply(null, args);
			} catch (e) {
				winston.error(`[activitypub/api] Error\n${e.stack}`);
			}
		}
	};
}

Out.follow = enabledCheck(async (type, id, actor) => {
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

Out.create = {};

Out.create.note = enabledCheck(async (uid, post) => {
	if (utils.isNumber(post)) {
		post = (await posts.getPostSummaryByPids([post], uid, { stripTags: false })).pop();
		if (!post) {
			return;
		}
	}
	const { pid } = post;
	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating creation of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { activity, targets } = await activitypub.mocks.activities.create(pid, uid, post);

	await Promise.all([
		activitypub.send('uid', uid, Array.from(targets), activity),
		activitypub.feps.announce(pid, activity),
		// utils.isNumber(post.cid) ? activitypubApi.add(caller, { pid }) : undefined,
	]);
});

Out.create.privateNote = enabledCheck(async (messageObj) => {
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

Out.update = {};

Out.update.profile = enabledCheck(async (uid, actorUid) => {
	// Local users only
	if (!utils.isNumber(uid)) {
		return;
	}

	const [object, targets] = await Promise.all([
		activitypub.mocks.actors.user(uid),
		db.getSortedSetMembers(`followersRemote:${uid}`),
	]);

	await activitypub.send('uid', actorUid || uid, targets, {
		id: `${object.id}#activity/update/${Date.now()}`,
		type: 'Update',
		actor: object.id,
		to: [activitypub._constants.publicAddress],
		cc: [],
		object,
	});
});

Out.update.category = enabledCheck(async (cid) => {
	// Local categories only
	if (!utils.isNumber(cid)) {
		return;
	}

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

Out.update.note = enabledCheck(async (uid, post) => {
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
		activitypub.send('uid', uid, Array.from(targets), payload),
		activitypub.feps.announce(post.pid, payload),
	]);
});

Out.update.privateNote = enabledCheck(async (uid, messageObj) => {
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

	await activitypub.send('uid', uid, targets, payload);
});

Out.delete = {};

Out.delete.note = enabledCheck(async (uid, pid) => {
	// Only applies to local posts
	if (!utils.isNumber(pid)) {
		return;
	}

	const id = `${nconf.get('url')}/post/${pid}`;
	const post = (await posts.getPostSummaryByPids([pid], uid, { stripTags: false })).pop();
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
		activitypub.send('uid', uid, Array.from(targets), payload),
		activitypub.feps.announce(pid, payload),
	]);
});

Out.like = {};

Out.like.note = enabledCheck(async (uid, pid) => {
	const payload = {
		id: `${nconf.get('url')}/uid/${uid}#activity/like/${encodeURIComponent(pid)}`,
		type: 'Like',
		actor: `${nconf.get('url')}/uid/${uid}`,
		object: utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid,
	};

	if (!activitypub.helpers.isUri(pid)) { // only 1b12 announce for local likes
		await activitypub.feps.announce(pid, payload);
		return;
	}

	const recipient = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(recipient)) {
		return;
	}

	await Promise.all([
		activitypub.send('uid', uid, [recipient], payload),
		activitypub.feps.announce(pid, payload),
	]);
});

Out.dislike = {};

Out.dislike.note = enabledCheck(async (uid, pid) => {
	const payload = {
		id: `${nconf.get('url')}/uid/${uid}#activity/dislike/${encodeURIComponent(pid)}`,
		type: 'Dislike',
		actor: `${nconf.get('url')}/uid/${uid}`,
		object: utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid,
	};

	if (!activitypub.helpers.isUri(pid)) { // only 1b12 announce for local likes
		await activitypub.feps.announce(pid, payload);
		return;
	}

	const recipient = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(recipient)) {
		return;
	}

	await Promise.all([
		activitypub.send('uid', uid, [recipient], payload),
		activitypub.feps.announce(pid, payload),
	]);
});

Out.announce = {};

Out.announce.topic = enabledCheck(async (tid, uid) => {
	const { mainPid: pid, cid } = await topics.getTopicFields(tid, ['mainPid', 'cid']);

	if (uid) {
		const exists = await user.exists(uid);
		if (!exists || !utils.isNumber(cid)) {
			return;
		}
	} else {
		// Only local categories can announce
		if (!utils.isNumber(cid) || parseInt(cid, 10) < 1) {
			return;
		}
	}

	const authorUid = await posts.getPostField(pid, 'uid'); // author
	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating announce of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await activitypub.buildRecipients({
		id: pid,
		to: [activitypub._constants.publicAddress],
	}, uid ? { uid } : { cid });
	if (!utils.isNumber(authorUid)) {
		cc.push(authorUid);
		targets.add(authorUid);
	}

	const payload = uid ? {
		id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/uid/${uid}`,
		type: 'Announce',
		actor: `${nconf.get('url')}/uid/${uid}`,
	} : {
		id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/cid/${cid}`,
		type: 'Announce',
		actor: `${nconf.get('url')}/category/${cid}`,
	};
	await activitypub.send(uid ? 'uid' : 'cid', uid || cid, Array.from(targets), {
		...payload,
		to,
		cc,
		object: utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid,
	});
});

Out.flag = enabledCheck(async (uid, flag) => {
	if (!activitypub.helpers.isUri(flag.targetId)) {
		return;
	}
	const reportedIds = [flag.targetId];
	if (flag.type === 'post' && activitypub.helpers.isUri(flag.targetUid)) {
		reportedIds.push(flag.targetUid);
	}
	const reason = flag.reason ||
		(flag.reports && flag.reports.filter(report => report.reporter.uid === uid).at(-1).value);
	await activitypub.send('uid', uid, reportedIds, {
		id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/flag/${uid}`,
		type: 'Flag',
		actor: `${nconf.get('url')}/uid/${uid}`,
		object: reportedIds,
		content: reason,
	});
	await db.sortedSetAdd(`flag:${flag.flagId}:remote`, Date.now(), uid);
});

Out.remove = {};

Out.remove.context = enabledCheck(async (uid, tid) => {
	// Federates Remove(Context); where Context is the tid
	const now = new Date();
	const cid = await topics.getTopicField(tid, 'oldCid');

	// Only local categories
	if (!utils.isNumber(cid) || parseInt(cid, 10) < 1) {
		return;
	}

	const allowed = await privileges.categories.can('topics:read', cid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating deletion of tid ${tid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await activitypub.buildRecipients({
		to: [activitypub._constants.publicAddress],
		cc: [],
	}, { cid });

	await activitypub.send('uid', uid, Array.from(targets), {
		id: `${nconf.get('url')}/topic/${tid}#activity/remove/${now.getTime()}`,
		type: 'Remove',
		actor: `${nconf.get('url')}/uid/${uid}`,
		to,
		cc,
		object: `${nconf.get('url')}/topic/${tid}`,
		target: `${nconf.get('url')}/category/${cid}`,
	});
});

Out.move = {};

Out.move.context = enabledCheck(async (uid, tid) => {
	// Federates Move(Context); where Context is the tid
	const now = new Date();
	const { cid, oldCid } = await topics.getTopicFields(tid, ['cid', 'oldCid']);

	// This check may be revised if inter-community moderation becomes real.
	const isLocal = id => utils.isNumber(id) && parseInt(id, 10) > 0;
	if (isLocal(oldCid) && !isLocal(cid)) { // moving to remote/uncategorized
		return Out.remove.context(uid, tid);
	} else if (
		(isLocal(cid) && !isLocal(oldCid)) || // stealing, or
		[cid, oldCid].every(id => !isLocal(id)) // remote-to-remote
	) {
		return;
	}

	const allowed = await privileges.categories.can('topics:read', cid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating move of tid ${tid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await activitypub.buildRecipients({
		to: [activitypub._constants.publicAddress],
		cc: [],
	}, { cid: [cid, oldCid] });

	await activitypub.send('uid', uid, Array.from(targets), {
		id: `${nconf.get('url')}/topic/${tid}#activity/move/${now.getTime()}`,
		type: 'Move',
		actor: `${nconf.get('url')}/uid/${uid}`,
		to,
		cc,
		object: `${nconf.get('url')}/topic/${tid}`,
		origin: `${nconf.get('url')}/category/${oldCid}`,
		target: `${nconf.get('url')}/category/${cid}`,
	});
});

Out.undo = {};

Out.undo.follow = enabledCheck(async (type, id, actor) => {
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

Out.undo.like = enabledCheck(async (uid, pid) => {
	if (!activitypub.helpers.isUri(pid)) {
		return;
	}

	const author = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(author)) {
		return;
	}

	const payload = {
		id: `${nconf.get('url')}/uid/${uid}#activity/undo:like/${encodeURIComponent(pid)}/${Date.now()}`,
		type: 'Undo',
		actor: `${nconf.get('url')}/uid/${uid}`,
		object: {
			actor: `${nconf.get('url')}/uid/${uid}`,
			id: `${nconf.get('url')}/uid/${uid}#activity/like/${encodeURIComponent(pid)}`,
			type: 'Like',
			object: pid,
		},
	};

	await Promise.all([
		activitypub.send('uid', uid, [author], payload),
		activitypub.feps.announce(pid, payload),
	]);
});

Out.undo.flag = enabledCheck(async (uid, flag) => {
	if (!activitypub.helpers.isUri(flag.targetId)) {
		return;
	}
	const reportedIds = [flag.targetId];
	if (flag.type === 'post' && activitypub.helpers.isUri(flag.targetUid)) {
		reportedIds.push(flag.targetUid);
	}
	const reason = flag.reason ||
		(flag.reports && flag.reports.filter(report => report.reporter.uid === uid).at(-1).value);
	await activitypub.send('uid', uid, reportedIds, {
		id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/undo:flag/${uid}/${Date.now()}`,
		type: 'Undo',
		actor: `${nconf.get('url')}/uid/${uid}`,
		object: {
			id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/flag/${uid}`,
			actor: `${nconf.get('url')}/uid/${uid}`,
			type: 'Flag',
			object: reportedIds,
			content: reason,
		},
	});
	await db.sortedSetRemove(`flag:${flag.flagId}:remote`, uid);
});

Out.undo.announce = enabledCheck(async (type, id, tid) => {
	if (!utils.isNumber(id) || !['uid', 'cid'].includes(type)) {
		throw new Error('[[error:invalid-data]]');
	}

	const exists = await Promise.all([
		topics.exists(tid),
		type === 'uid' ? user.exists(id) : categories.exists(id),
	]);
	if (!exists.every(Boolean)) {
		throw new Error('[[error:invalid-data]]');
	}

	const baseUrl = `${nconf.get('url')}/${type === 'uid' ? 'uid' : 'category'}/${id}`;
	const { uid, mainPid: pid } = await topics.getTopicFields(tid, ['uid', 'mainPid']);
	const allowed = await privileges.topics.can('topics:read', tid, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/api] Not federating announce of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await activitypub.buildRecipients({
		id: pid,
		to: [activitypub._constants.publicAddress],
		cc: [`${baseUrl}/followers`, uid],
	}, {
		uid: type === 'uid' && id,
		cid: type === 'cid' && id,
	});


	// Just undo the announce.
	await activitypub.send(type, id, Array.from(targets), {
		id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/undo:announce/${type}/${id}`,
		type: 'Undo',
		actor: baseUrl,
		to,
		cc,
		object: {
			id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/${type}/${id}`,
			type: 'Announce',
			actor: baseUrl,
			to,
			cc,
			object: pid,
		},
	});
});