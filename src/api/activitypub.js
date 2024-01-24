'use strict';

/**
 * DEVELOPMENT NOTE
 *
 * THIS FILE IS UNDER ACTIVE DEVELOPMENT AND IS EXPLICITLY EXCLUDED FROM IMMUTABILITY GUARANTEES
 *
 * If you use api methods in this file, be prepared that they may be removed or modified with no warning.
 */

const nconf = require('nconf');

const db = require('../database');
const activitypub = require('../activitypub');
const user = require('../user');
const posts = require('../posts');

const activitypubApi = module.exports;

activitypubApi.follow = async (caller, { uid: actorId } = {}) => {
	const object = await activitypub.getActor(caller.uid, actorId);
	if (!object) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	await activitypub.send(caller.uid, actorId, {
		type: 'Follow',
		object: object.id,
	});
};

activitypubApi.unfollow = async (caller, { uid: actorId }) => {
	const object = await activitypub.getActor(caller.uid, actorId);
	const userslug = await user.getUserField(caller.uid, 'userslug');
	if (!object) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	await activitypub.send(caller.uid, actorId, {
		type: 'Undo',
		object: {
			type: 'Follow',
			actor: `${nconf.get('url')}/user/${userslug}`,
			object: object.id,
		},
	});

	await Promise.all([
		db.sortedSetRemove(`followingRemote:${caller.uid}`, object.id),
		db.decrObjectField(`user:${caller.uid}`, 'followingRemoteCount'),
	]);
};

activitypubApi.create = {};

activitypubApi.create.post = async (caller, { post }) => {
	const id = `${nconf.get('url')}/post/${post.pid}`;
	const published = new Date(post.timestamp).toISOString();
	const [userslug, raw, followers] = await Promise.all([
		user.getUserField(caller.uid, 'userslug'),
		posts.getPostField(post.pid, 'content'),
		db.getSortedSetMembers(`followersRemote:${caller.uid}`),
	]);

	// todo: post visibility, category privileges integration
	const recipients = {
		to: [activitypub._constants.publicAddress],
		cc: [`${nconf.get('url')}/user/${userslug}/followers`],
	};
	const targets = new Set(followers);

	let inReplyTo = null;
	if (post.toPid) {
		inReplyTo = activitypub.helpers.isUri(post.toPid) ? post.toPid : id;
		const parentId = await posts.getPostField(post.toPid, 'uid');
		if (activitypub.helpers.isUri(parentId)) {
			recipients.to.unshift(parentId);
			targets.add(parentId);
		}
	}

	const object = {
		id,
		type: 'Note',
		...recipients,
		inReplyTo,
		published,
		url: id,
		attributedTo: `${nconf.get('url')}/user/${post.user.userslug}`,
		sensitive: false, // todo
		content: post.content,
		source: {
			content: raw,
			mediaType: 'text/markdown',
		},
		// replies: {}  todo...
	};

	const payload = {
		type: 'Create',
		...recipients,
		object,
	};

	await activitypub.send(caller.uid, Array.from(targets), payload);
};
