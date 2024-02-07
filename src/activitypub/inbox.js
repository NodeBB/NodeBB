'use strict';

const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');
const categories = require('../categories');
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

inbox.like = async (req) => {
	const { actor, object } = req.body;
	const { type, id } = await activitypub.helpers.resolveLocalId(object);
	if (type !== 'post' || !(await posts.exists(id))) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	winston.info(`[activitypub/inbox/like] id ${id} via ${actor}`);

	await posts.upvote(id, actor);
};

inbox.announce = async (req) => {
	const { actor, object, published } = req.body;
	let timestamp = Date.now();
	try {
		timestamp = new Date(published).getTime();
	} catch (e) {
		// ok to fail
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	let tid;
	let pid;

	if (String(object).startsWith(nconf.get('url'))) {
		const { type, id } = await activitypub.helpers.resolveLocalId(object);
		if (type !== 'post' || !(await posts.exists(id))) {
			throw new Error('[[error:activitypub.invalid-id]]');
		}

		pid = id;
		tid = await posts.getPostField(id, 'tid');
	} else {
		pid = object;
		tid = await activitypub.notes.assertTopic(0, object);
		await topics.updateLastPostTime(tid, timestamp);
	}

	winston.info(`[activitypub/inbox/announce] Parsing id ${pid}`);

	// No double-announce allowed
	const existing = await topics.events.find(tid, {
		type: 'announce',
		uid: actor,
		pid,
	});
	if (existing.length) {
		await topics.events.purge(tid, existing);
	}

	await topics.events.log(tid, {
		type: 'announce',
		uid: actor,
		href: `/post/${pid}`,
		pid,
		timestamp,
	});
};

inbox.follow = async (req) => {
	// Sanity checks
	const { type, id } = await helpers.resolveLocalId(req.body.object);
	if (!['category', 'user'].includes(type)) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	const assertion = await activitypub.actors.assert(req.body.actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'user') {
		const exists = await user.exists(id);
		if (!exists) {
			throw new Error('[[error:invalid-uid]]');
		}

		const isFollowed = await inbox.isFollowed(req.body.actor, id);
		if (isFollowed) {
			// No additional parsing required
			return;
		}

		const now = Date.now();
		await db.sortedSetAdd(`followersRemote:${id}`, now, req.body.actor);

		const followerRemoteCount = await db.sortedSetCard(`followersRemote:${id}`);
		await user.setUserField(id, 'followerRemoteCount', followerRemoteCount);

		await activitypub.send('uid', id, req.body.actor, {
			type: 'Accept',
			object: {
				type: 'Follow',
				actor: req.body.actor,
			},
		});
	} else if (type === 'category') {
		const exists = await categories.exists(id);
		if (!exists) {
			throw new Error('[[error:invalid-cid]]');
		}

		const watchState = await categories.getWatchState([id], req.body.actor);
		if (watchState[0] !== categories.watchStates.tracking) {
			await user.setCategoryWatchState(req.body.actor, id, categories.watchStates.tracking);
		}

		await activitypub.send('cid', id, req.body.actor, {
			type: 'Accept',
			object: {
				type: 'Follow',
				actor: req.body.actor,
			},
		});
	}
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

	const { type: localType, id: uid } = await helpers.resolveLocalId(object.actor);
	if (localType !== 'user' || !uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'Follow') {
		const now = Date.now();
		await db.sortedSetAdd(`followingRemote:${uid}`, now, actor);
		const followingRemoteCount = await db.sortedSetCard(`followingRemote:${uid}`);
		await user.setUserField(uid, 'followingRemoteCount', followingRemoteCount);
	}
};

inbox.undo = async (req) => {
	// todo: "actor" in this case should be the one in object, no?
	const { actor, object } = req.body;
	const { type } = object;

	if (actor !== object.actor) {
		throw new Error('[[error:activitypub.actor-mismatch]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	const { type: localType, id } = await helpers.resolveLocalId(object.object);

	winston.info(`[activitypub/inbox/undo] ${type} ${localType} ${id} via ${actor}`);

	switch (type) {
		case 'Follow': {
			switch (localType) {
				case 'user': {
					const exists = await user.exists(id);
					if (!exists) {
						throw new Error('[[error:invalid-uid]]');
					}

					await db.sortedSetRemove(`followersRemote:${id}`, actor);
					const followerRemoteCount = await db.sortedSetCard(`followerRemote:${id}`);
					await user.setUserField(id, 'followerRemoteCount', followerRemoteCount);
					break;
				}

				case 'category': {
					const exists = await categories.exists(id);
					if (!exists) {
						throw new Error('[[error:invalid-cid]]');
					}

					await user.setCategoryWatchState(actor, id, categories.watchStates.notwatching);
					break;
				}
			}

			break;
		}

		case 'Like': {
			const exists = await posts.exists(id);
			if (localType !== 'post' || !exists) {
				throw new Error('[[error:invalid-pid]]');
			}

			await posts.unvote(id, actor);
			break;
		}

		case 'Announce': {
			const exists = await posts.exists(id);
			if (localType !== 'post' || !exists) {
				throw new Error('[[error:invalid-pid]]');
			}

			const tid = await posts.getPostField(id, 'tid');
			const existing = await topics.events.find(tid, {
				type: 'announce',
				uid: actor,
				pid: id,
			});

			if (existing.length) {
				await topics.events.purge(tid, existing);
			}
		}
	}
};
