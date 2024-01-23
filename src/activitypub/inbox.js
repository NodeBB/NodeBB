'use strict';

const winston = require('winston');

const db = require('../database');
const user = require('../user');
const activitypub = require('.');

const helpers = require('./helpers');

const inbox = module.exports;

inbox.create = async (req) => {
	const { object } = req.body;
	const postData = await activitypub.mocks.post(object);

	if (postData) {
		await activitypub.notes.assert(0, [postData]);
		const tid = await activitypub.notes.assertTopic(0, postData.pid);
		winston.info(`[activitypub/inbox] Parsing note ${postData.pid} into topic ${tid}`);
	} else {
		winston.warn('[activitypub/inbox] Received object was not a note');
	}
};

inbox.update = async (req) => {
	const { object } = req.body;
	const postData = await activitypub.mocks.post(object);

	if (postData) {
		await activitypub.notes.assert(0, [postData], { update: true });
		winston.info(`[activitypub/inbox] Updating note ${postData.pid}`);
	} else {
		winston.warn('[activitypub/inbox] Received object was not a note');
	}
};

inbox.follow = async (req) => {
	// Sanity checks
	const localUid = await helpers.resolveLocalUid(req.body.object);
	if (!localUid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const from = await activitypub.getActor(localUid, req.body.actor);
	if (!from) {
		throw new Error('[[error:invalid-uid]]'); // should probably be AP specific
	}

	const isFollowed = await inbox.isFollowed(from.id, localUid);
	if (isFollowed) {
		// No additional parsing required
		return;
	}

	const now = Date.now();
	await db.sortedSetAdd(`followersRemote:${localUid}`, now, from.id);
	await activitypub.send(localUid, from.id, {
		type: 'Accept',
		object: {
			type: 'Follow',
			actor: from.id,
		},
	});

	const followerRemoteCount = await db.sortedSetCard(`followersRemote:${localUid}`);
	await user.setUserField(localUid, 'followerRemoteCount', followerRemoteCount);
};

inbox.isFollowed = async (actorId, uid) => {
	if (actorId.indexOf('@') === -1 || parseInt(uid, 10) <= 0) {
		return false;
	}
	return await db.isSortedSetMember(`followersRemote:${uid}`, actorId);
};

inbox.accept = async (req) => {
	let { actor, object } = req.body;
	const { type } = object;

	const uid = await helpers.resolveLocalUid(object.actor);
	if (!uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	actor = await activitypub.getActor(uid, actor);

	if (type === 'Follow') {
		const now = Date.now();
		await Promise.all([
			db.sortedSetAdd(`followingRemote:${uid}`, now, actor.id),
			db.incrObjectField(`user:${uid}`, 'followingRemoteCount'),
		]);
	}
};

inbox.undo = async (req) => {
	let { actor, object } = req.body;
	const { type } = object;

	const uid = await helpers.resolveLocalUid(object.object);
	if (!uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	actor = await activitypub.getActor(uid, actor);

	if (type === 'Follow') {
		await Promise.all([
			db.sortedSetRemove(`followingRemote:${uid}`, actor.id),
			db.decrObjectField(`user:${uid}`, 'followingRemoteCount'),
		]);
	}
};
