'use strict';

const db = require('../database');
const user = require('../user');
const activitypub = require('.');

const helpers = require('./helpers');

const inbox = module.exports;

inbox.follow = async (actorId, objectId) => {
	await handleFollow('follow', actorId, objectId);
};

inbox.unfollow = async (actorId, objectId) => {
	await handleFollow('unfollow', actorId, objectId);
};

inbox.isFollowed = async (actorId, uid) => {
	if (actorId.indexOf('@') === -1 || parseInt(uid, 10) <= 0) {
		return false;
	}
	return await db.isSortedSetMember(`followersRemote:${uid}`, actorId);
};

async function handleFollow(type, actorId, objectId) {
	// Sanity checks
	const from = await helpers.query(actorId);
	if (!actorId || !from) {
		throw new Error('[[error:invalid-uid]]'); // should probably be AP specific
	}

	if (!objectId) {
		throw new Error('[[error:invalid-uid]]'); // should probably be AP specific
	}

	const localUid = await helpers.resolveLocalUid(objectId);
	if (!localUid) {
		throw new Error('[[error:invalid-uid]]');
	}

	// matches toggleFollow() in src/user/follow.js
	const isFollowed = await inbox.isFollowed(actorId, localUid);
	if (type === 'follow') {
		if (isFollowed) {
			throw new Error('[[error:already-following]]');
		}
		const now = Date.now();
		await db.sortedSetAdd(`followersRemote:${localUid}`, now, actorId);
		await activitypub.send(localUid, actorId, {
			type: 'Accept',
			object: {
				type: 'Follow',
				actor: from.actorUri,
			},
		});
	} else {
		if (!isFollowed) {
			throw new Error('[[error:not-following]]');
		}
		await db.sortedSetRemove(`followersRemote:${localUid}`, actorId);
		await activitypub.send(localUid, actorId, {
			type: 'Undo',
			object: {
				type: 'Follow',
				actor: from.actorUri,
			},
		});
	}

	const followerRemoteCount = await db.sortedSetCard(`followersRemote:${localUid}`);
	await user.setUserField(localUid, 'followerRemoteCount', followerRemoteCount);
}

inbox.accept = async (req) => {
	const { actor, object } = req.body;
	const { type } = object;

	if (type === 'Follow') {
		// todo: should check that actor and object.actor are the same person?
		const uid = await helpers.resolveLocalUid(object.actor);
		if (!uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		const now = Date.now();
		await Promise.all([
			db.sortedSetAdd(`followingRemote:${uid}`, now, actor.name),
			db.incrObjectField(`user:${uid}`, 'followingRemoteCount'),
		]);
	}
};

inbox.undo = async (req) => {
	const { actor, object } = req.body;
	const { type } = object;

	if (type === 'Follow') {
		// todo: should check that actor and object.actor are the same person?
		const uid = await helpers.resolveLocalUid(object.actor);
		if (!uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		await Promise.all([
			db.sortedSetRemove(`followingRemote:${uid}`, actor.name),
			db.decrObjectField(`user:${uid}`, 'followingRemoteCount'),
		]);
	}
};
