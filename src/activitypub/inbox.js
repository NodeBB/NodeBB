'use strict';

const db = require('../database');
const user = require('../user');

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
	const actorExists = await helpers.query(actorId);
	if (!actorId || !actorExists) {
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
	} else {
		if (!isFollowed) {
			throw new Error('[[error:not-following]]');
		}
		await db.sortedSetRemove(`followersRemote:${localUid}`, actorId);
	}

	const [followerCount, followerRemoteCount] = await Promise.all([
		db.sortedSetCard(`followers:${localUid}`),
		db.sortedSetCard(`followersRemote:${localUid}`),
	]);
	await user.setUserField(localUid, 'followerCount', followerCount + followerRemoteCount);
}
