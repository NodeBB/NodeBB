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

activitypubApi.follow = enabledCheck(async (caller, { uid } = {}) => {
	const result = await activitypub.helpers.query(uid);
	if (!result) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	await activitypub.send('uid', caller.uid, [result.actorUri], {
		id: `${nconf.get('url')}/uid/${caller.uid}#activity/follow/${result.username}@${result.hostname}`,
		type: 'Follow',
		object: result.actorUri,
	});

	await db.sortedSetAdd(`followRequests:${caller.uid}`, Date.now(), result.actorUri);
});

// should be .undo.follow
activitypubApi.unfollow = enabledCheck(async (caller, { uid }) => {
	const result = await activitypub.helpers.query(uid);
	if (!result) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	await activitypub.send('uid', caller.uid, [result.actorUri], {
		type: 'Undo',
		object: {
			type: 'Follow',
			actor: `${nconf.get('url')}/uid/${caller.uid}`,
			object: result.actorUri,
		},
	});

	await Promise.all([
		db.sortedSetRemove(`followingRemote:${caller.uid}`, result.actorUri),
		db.decrObjectField(`user:${caller.uid}`, 'followingRemoteCount'),
	]);
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
		type: 'Undo',
		object: {
			actor: `${nconf.get('url')}/uid/${caller.uid}`,
			type: 'Like',
			object: pid,
		},
	});
});
