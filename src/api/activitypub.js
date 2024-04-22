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

const activitypubApi = module.exports;

function noop() {}

function enabledCheck(next) {
	return async function (caller, params) {
		if (!meta.config.activitypubEnabled) {
			return noop;
		}

		next(caller, params);
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

	await activitypub.send(type, id, [actor], {
		id: `${nconf.get('url')}/${type}/${id}#activity/follow/${handle}`,
		type: 'Follow',
		object: actor,
	});

	await db.sortedSetAdd(`followRequests:${type}.${id}`, Date.now(), actor);
});

// should be .undo.follow
activitypubApi.unfollow = enabledCheck(async (caller, { type, id, actor }) => {
	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	actor = actor.includes('@') ? await user.getUidByUserslug(actor) : actor;
	const handle = await user.getUserField(actor, 'username');

	const object = {
		id: `${nconf.get('url')}/${type}/${id}#activity/follow/${handle}`,
		type: 'Follow',
		object: actor,
	};
	if (type === 'uid') {
		object.actor = `${nconf.get('url')}/uid/${id}`;
	} else if (type === 'cid') {
		object.actor = `${nconf.get('url')}/category/${id}`;
	}

	await activitypub.send(type, id, [actor], {
		id: `${nconf.get('url')}/${type}/${id}#activity/undo:follow/${handle}`,
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
		]);
	}
});

activitypubApi.create = {};

// this might be better genericised... tbd. some of to/cc is built in mocks.
async function buildRecipients(object, uid) {
	const followers = await db.getSortedSetMembers(`followersRemote:${uid}`);
	let { to, cc } = object;
	to = new Set(to);
	cc = new Set(cc);


	// Directly address user if inReplyTo
	const parentId = await posts.getPostField(object.inReplyTo, 'uid');
	if (activitypub.helpers.isUri(parentId) && to.has(parentId)) {
		to.add(parentId);
	}

	const targets = new Set([...followers, ...to, ...cc]);
	targets.delete(`${nconf.get('url')}/uid/${uid}/followers`); // followers URL not targeted
	targets.delete(activitypub._constants.publicAddress); // public address not targeted

	object.to = Array.from(to);
	object.cc = Array.from(cc);
	return { targets };
}

activitypubApi.create.post = enabledCheck(async (caller, { pid }) => {
	const post = (await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false })).pop();
	if (!post) {
		return;
	}

	const allowed = await privileges.posts.can('topics:read', pid, activitypub._constants.uid);
	if (!allowed) {
		winston.verbose(`[activitypub/api] Not federating creation of pid ${pid} to the fediverse due to privileges.`);
		return;
	}

	const object = await activitypub.mocks.note(post);
	const { targets } = await buildRecipients(object, post.user.uid);
	const { cid } = post.category;
	const followers = await activitypub.notes.getCategoryFollowers(cid);

	const payloads = {
		create: {
			id: `${object.id}#activity/create`,
			type: 'Create',
			to: object.to,
			cc: object.cc,
			object,
		},
		announce: {
			id: `${object.id}#activity/announce`,
			type: 'Announce',
			to: [`${nconf.get('url')}/category/${cid}/followers`],
			cc: [activitypub._constants.publicAddress],
			object,
		},
	};

	await activitypub.send('uid', caller.uid, Array.from(targets), payloads.create);
	if (followers.length) {
		await activitypub.send('cid', cid, followers, payloads.announce);
	}
});

activitypubApi.update = {};

activitypubApi.update.profile = enabledCheck(async (caller, { uid }) => {
	const [object, followers] = await Promise.all([
		activitypub.mocks.actors.user(uid),
		db.getSortedSetMembers(`followersRemote:${caller.uid}`),
	]);

	await activitypub.send('uid', caller.uid, followers, {
		id: `${object.id}#activity/update/${Date.now()}`,
		type: 'Update',
		to: [activitypub._constants.publicAddress],
		cc: [],
		object,
	});
});

activitypubApi.update.note = enabledCheck(async (caller, { post }) => {
	const object = await activitypub.mocks.note(post);
	const { targets } = await buildRecipients(object, post.user.uid);

	const allowed = await privileges.posts.can('topics:read', post.pid, activitypub._constants.uid);
	if (!allowed) {
		winston.verbose(`[activitypub/api] Not federating update of pid ${post.pid} to the fediverse due to privileges.`);
		return;
	}

	const payload = {
		id: `${object.id}#activity/update/${post.edited}`,
		type: 'Update',
		to: object.to,
		cc: object.cc,
		object,
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
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/undo:like/${encodeURIComponent(pid)}`,
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
		id: `${nconf.get('url')}/${flag.type}/${encodeURIComponent(flag.targetId)}#activity/undo:flag/${caller.uid}`,
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
