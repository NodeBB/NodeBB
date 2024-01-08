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

const activitypubApi = module.exports;

activitypubApi.follow = async (caller, { actorId } = {}) => {
	const object = await activitypub.getActor(caller.uid, actorId);
	if (!object) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	await activitypub.send(caller.uid, actorId, {
		type: 'Follow',
		object: object.id,
	});
};

activitypubApi.unfollow = async (caller, { actorId }) => {
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
