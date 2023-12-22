'use strict';

/**
 * DEVELOPMENT NOTE
 *
 * THIS FILE IS UNDER ACTIVE DEVELOPMENT AND IS EXPLICITLY EXCLUDED FROM IMMUTABILITY GUARANTEES
 *
 * If you use api methods in this file, be prepared that they may be removed or modified with no warning.
 */

const db = require('../database');
const activitypub = require('../activitypub');

const activitypubApi = module.exports;

activitypubApi.follow = async (caller, { actorId } = {}) => {
	const object = activitypub.getActor(actorId);
	if (!object) {
		throw new Error('[[error:invalid-uid]]'); // should be activitypub-specific
	}

	await activitypub.send(caller.uid, actorId, {
		type: 'Follow',
		object: object.actorUri,
	});

	const now = Date.now();
	await Promise.all([
		db.sortedSetAdd(`followingRemote:${caller.uid}`, now, actorId),
		db.incrObjectField(`user:${caller.uid}`, 'followingRemoteCount'),
	]);
};

activitypubApi.unfollow = async (caller, { actorId }) => {
	if (!actorId) {
		throw new Error('[[error:invalid-uid]]'); // should be activitypub-specific
	}

	await activitypub.send(caller.uid, actorId, {
		type: 'Unfollow',
		object: {
			type: 'Person',
			name: actorId,
		},
	});

	await Promise.all([
		db.sortedSetRemove(`followingRemote:${caller.uid}`, actorId),
		db.decrObjectField(`user:${caller.uid}`, 'followingRemoteCount'),
	]);
};
