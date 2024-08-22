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
const meta = require('../meta');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const posts = require('../posts');
const topics = require('../topics');
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
	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	actor = actor.includes('@') ? await user.getUidByUserslug(actor) : actor;
	const handle = await user.getUserField(actor, 'username');
	const timestamp = Date.now();

	await activitypub.send(type, id, [actor], {
		id: `${nconf.get('url')}/${type}/${id}#activity/follow/${handle}/${timestamp}`,
		type: 'Follow',
		object: actor,
	});

	await db.sortedSetAdd(`followRequests:${type}.${id}`, timestamp, actor);
});

// should be .undo.follow
activitypubApi.unfollow = enabledCheck(async (caller, { type, id, actor }) => {
	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	actor = actor.includes('@') ? await user.getUidByUserslug(actor) : actor;
	const handle = await user.getUserField(actor, 'username');
	const timestamps = await db.sortedSetsScore([
		`followRequests:${type}.${id}`,
		type === 'uid' ? `followingRemote:${id}` : `cid:${id}:following`,
	], actor);
	const timestamp = timestamps[0] || timestamps[1];

	const object = {
		id: `${nconf.get('url')}/${type}/${id}#activity/follow/${handle}/${timestamp}`,
		type: 'Follow',
		object: actor,
	};
	if (type === 'uid') {
		object.actor = `${nconf.get('url')}/uid/${id}`;
	} else if (type === 'cid') {
		object.actor = `${nconf.get('url')}/category/${id}`;
	}

	await activitypub.send(type, id, [actor], {
		id: `${nconf.get('url')}/${type}/${id}#activity/undo:follow/${handle}/${timestamp}`,
		type: 'Undo',
		object,
	});

	if (type === 'uid') {
		await Promise.all([
			db.sortedSetRemove(`followingRemote:${id}`, actor),
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

async function buildRecipients(object, { pid, uid }) {
	/**
	 * - Builds a list of targets for activitypub.send to consume
	 * - Extends to and cc since the activity can be addressed more widely
	 */
	const followers = await db.getSortedSetMembers(`followersRemote:${uid}`);
	let { to, cc } = object;
	to = new Set(to);
	cc = new Set(cc);

	const followersUrl = `${nconf.get('url')}/uid/${uid}/followers`;
	if (!to.has(followersUrl)) {
		cc.add(followersUrl);
	}

	const targets = new Set([...followers, ...to, ...cc]);

	// Remove any ids that aren't asserted actors
	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', [...targets]);
	Array.from(targets).forEach((uri, idx) => {
		if (!exists[idx]) {
			targets.delete(uri);
		}
	});

	// Announcers and their followers
	if (pid) {
		const announcers = (await activitypub.notes.announce.list({ pid })).map(({ actor }) => actor);
		const announcersFollowers = (await user.getUsersFields(announcers, ['followersUrl']))
			.filter(o => o.hasOwnProperty('followersUrl'))
			.map(({ followersUrl }) => followersUrl);
		[...announcers].forEach(uri => targets.add(uri));
		[...announcers, ...announcersFollowers].forEach(uri => cc.add(uri));
	}

	return {
		to: [...to],
		cc: [...cc],
		targets,
	};
}

activitypubApi.create.note = enabledCheck(async (caller, { pid }) => {
	const post = (await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false })).pop();
	if (!post) {
		return;
	}

	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		// winston.verbose(`[activitypub/api] Not federating creation of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const object = await activitypub.mocks.note(post);
	const { to, cc, targets } = await buildRecipients(object, { uid: post.user.uid });
	const { cid } = post.category;
	const followers = await activitypub.notes.getCategoryFollowers(cid);

	const payload = {
		id: `${object.id}#activity/create/${Date.now()}`,
		type: 'Create',
		to,
		cc,
		object,
	};

	await activitypub.send('uid', caller.uid, Array.from(targets), payload);

	if (followers.length) {
		setTimeout(() => { // Delay sending to avoid potential race condition
			Promise.all([payload, payload.object].map(async (object) => {
				await activitypub.send('cid', cid, followers, {
					id: `${object.object ? object.object.id : object.id}#activity/announce/${Date.now()}`,
					type: 'Announce',
					to: [activitypub._constants.publicAddress],
					cc: [`${nconf.get('url')}/category/${cid}/followers`],
					object,
				});
			})).catch(err => winston.error(err.stack));
		}, 5000);
	}
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

	const object = await activitypub.mocks.note(post);
	const { to, cc, targets } = await buildRecipients(object, { pid: post.pid, uid: post.user.uid });

	const allowed = await privileges.posts.can('topics:read', post.pid, activitypub._constants.uid);
	if (!allowed) {
		// winston.verbose(
		// `[activitypub/api] Not federating update of pid ${post.pid} to the fediverse due to privileges.`
		// );
		return;
	}

	const payload = {
		id: `${object.id}#activity/update/${post.edited || Date.now()}`,
		type: 'Update',
		to,
		cc,
		object,
	};

	await activitypub.send('uid', caller.uid, Array.from(targets), payload);
});

activitypubApi.delete = {};

activitypubApi.delete.note = enabledCheck(async (caller, { pid }) => {
	// Only applies to local posts
	if (!utils.isNumber(pid)) {
		return;
	}

	const id = `${nconf.get('url')}/post/${pid}`;
	const post = (await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false })).pop();
	const object = await activitypub.mocks.note(post);
	const { to, cc, targets } = await buildRecipients(object, { pid, uid: post.user.uid });

	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		// winston.verbose(`[activitypub/api] Not federating update of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const payload = {
		id: `${id}#activity/delete/${Date.now()}`,
		type: 'Delete',
		to,
		cc,
		object: id,
		origin: object.context,
	};

	await activitypub.send('uid', caller.uid, Array.from(targets), payload);
});

activitypubApi.like = {};

activitypubApi.like.note = enabledCheck(async (caller, { pid }) => {
	if (!activitypub.helpers.isUri(pid)) { // remote only
		return;
	}

	const uid = await posts.getPostField(pid, 'uid');
	if (!activitypub.helpers.isUri(uid)) {
		return;
	}

	await activitypub.send('uid', caller.uid, [uid], {
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/like/${encodeURIComponent(pid)}`,
		type: 'Like',
		object: pid,
	});
});

activitypubApi.announce = {};

activitypubApi.announce.note = enabledCheck(async (caller, { tid }) => {
	const { mainPid: pid, cid } = await topics.getTopicFields(tid, ['mainPid', 'cid']);

	// Only remote posts can be announced
	if (utils.isNumber(pid)) {
		return;
	}

	const uid = await posts.getPostField(pid, 'uid'); // author
	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		// winston.verbose(`[activitypub/api] Not federating announce of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const { to, cc, targets } = await buildRecipients({
		to: [`${nconf.get('url')}/uid/${caller.uid}/followers`],
		cc: [uid],
	}, { uid: caller.uid });

	await activitypub.send('uid', caller.uid, Array.from(targets), {
		id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/${Date.now()}`,
		type: 'Announce',
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

	await activitypub.send('uid', caller.uid, [uid], {
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/undo:like/${encodeURIComponent(pid)}/${Date.now()}`,
		type: 'Undo',
		object: {
			actor: `${nconf.get('url')}/uid/${caller.uid}`,
			id: `${nconf.get('url')}/uid/${caller.uid}#activity/like/${encodeURIComponent(pid)}`,
			type: 'Like',
			object: pid,
		},
	});
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
		object: reportedIds,
		content: reason,
	});
	await db.sortedSetAdd(`flag:${flag.flagId}:remote`, Date.now(), caller.uid);
});

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
