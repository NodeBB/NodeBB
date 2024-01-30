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
	const { actor, object } = req.body;

	// Origin checking
	const actorHostname = new URL(actor).hostname;
	const objectHostname = new URL(object.id).hostname;
	if (actorHostname !== objectHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	switch (object.type) {
		case 'Note': {
			const postData = await activitypub.mocks.post(object);

			if (postData) {
				await activitypub.notes.assert(0, [postData], { update: true });
				winston.info(`[activitypub/inbox.update] Updating note ${postData.pid}`);
			} else {
				winston.warn(`[activitypub/inbox.update] Received note did not parse properly (id: ${object.id})`);
			}
			break;
		}

		case 'Person': {
			await activitypub.actors.assert(object, { update: true });
			break;
		}
	}
};

inbox.follow = async (req) => {
	// Sanity checks
	const localUid = await helpers.resolveLocalUid(req.body.object);
	if (!localUid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const assertion = await activitypub.actors.assert(req.body.actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	const isFollowed = await inbox.isFollowed(req.body.actor, localUid);
	if (isFollowed) {
		// No additional parsing required
		return;
	}

	const now = Date.now();
	await db.sortedSetAdd(`followersRemote:${localUid}`, now, req.body.actor);
	await activitypub.send(localUid, req.body.actor, {
		type: 'Accept',
		object: {
			type: 'Follow',
			actor: req.body.actor,
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
	const { actor, object } = req.body;
	const { type } = object;

	const uid = await helpers.resolveLocalUid(object.actor);
	if (!uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'Follow') {
		const now = Date.now();
		await Promise.all([
			db.sortedSetAdd(`followingRemote:${uid}`, now, actor),
			db.incrObjectField(`user:${uid}`, 'followingRemoteCount'),
		]);
	}
};

inbox.undo = async (req) => {
	const { actor, object } = req.body;
	const { type } = object;

	const uid = await helpers.resolveLocalUid(object.object);
	if (!uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'Follow') {
		await Promise.all([
			db.sortedSetRemove(`followersRemote:${uid}`, actor),
			db.decrObjectField(`user:${uid}`, 'followerRemoteCount'),
		]);
	}
};
