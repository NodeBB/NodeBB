'use strict';

const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const privileges = require('../privileges');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');
const categories = require('../categories');
const notifications = require('../notifications');
const utils = require('../utils');
const activitypub = require('.');

const socketHelpers = require('../socket.io/helpers');
const helpers = require('./helpers');

const inbox = module.exports;

inbox.create = async (req) => {
	const { object } = req.body;

	// Temporary, reject non-public notes.
	if (![...object.to, ...object.cc].includes(activitypub._constants.publicAddress)) {
		throw new Error('[[error:activitypub.not-implemented]]');
	}

	const tid = await activitypub.notes.assertTopic(0, object.id);
	winston.verbose(`[activitypub/inbox] Parsing note ${object.id} into topic ${tid}`);
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
			try {
				await posts.edit(postData);
			} catch (e) {
				activitypub.send('uid', 0, actor, {
					type: 'Reject',
					object: {
						type: 'Update',
						actor,
						object,
					},
				});
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
	const reject = () => {
		activitypub.send('uid', 0, actor, {
			type: 'Reject',
			object: {
				type: 'Like',
				actor,
				object,
			},
		});
	};

	if (type !== 'post' || !(await posts.exists(id))) {
		return reject();
	}

	const allowed = await privileges.posts.can('posts:upvote', id, activitypub._constants.uid);
	if (!allowed) {
		winston.info(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
		return reject();
	}

	winston.info(`[activitypub/inbox/like] id ${id} via ${actor}`);

	const result = await posts.upvote(id, actor);
	socketHelpers.upvote(result, 'notifications:upvoted-your-post-in');
};

inbox.announce = async (req) => {
	const { actor, object, published, to, cc } = req.body;
	let timestamp = new Date(published);
	timestamp = timestamp.toString() !== 'Invalid Date' ? timestamp.getTime() : Date.now();

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

		socketHelpers.sendNotificationToPostOwner(pid, actor, 'announce', 'notifications:activitypub.announce');
	} else {
		pid = object;
		pid = await activitypub.resolveId(0, pid); // in case wrong id is passed-in; unlikely, but still.
		if (!pid) {
			return;
		}

		tid = await activitypub.notes.assertTopic(0, pid);
		if (!tid) {
			return;
		}

		await topics.updateLastPostTime(tid, timestamp);
		await activitypub.notes.updateLocalRecipients(pid, { to, cc });
		await activitypub.notes.syncUserInboxes(tid);
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
		href: utils.isNumber(pid) ? `/post/${pid}` : pid,
		pid,
		timestamp,
	});
};

inbox.follow = async (req) => {
	const { actor, object } = req.body;
	// Sanity checks
	const { type, id } = await helpers.resolveLocalId(object);
	if (!['category', 'user'].includes(type)) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'user') {
		const exists = await user.exists(id);
		if (!exists) {
			throw new Error('[[error:invalid-uid]]');
		}

		const isFollowed = await inbox.isFollowed(actor, id);
		if (isFollowed) {
			// No additional parsing required
			return;
		}

		const now = Date.now();
		await db.sortedSetAdd(`followersRemote:${id}`, now, actor);

		const followerRemoteCount = await db.sortedSetCard(`followersRemote:${id}`);
		await user.setUserField(id, 'followerRemoteCount', followerRemoteCount);

		user.onFollow(actor, id);
		activitypub.send('uid', id, actor, {
			type: 'Accept',
			object: {
				type: 'Follow',
				actor,
			},
		});
	} else if (type === 'category') {
		const [exists, allowed] = await Promise.all([
			categories.exists(id),
			privileges.categories.can('read', id, 'activitypub._constants.uid'),
		]);
		if (!exists) {
			throw new Error('[[error:invalid-cid]]');
		}
		if (!allowed) {
			return activitypub.send('uid', 0, actor, {
				type: 'Reject',
				object: {
					type: 'Follow',
					actor,
					object,
				},
			});
		}

		const watchState = await categories.getWatchState([id], actor);
		if (watchState[0] !== categories.watchStates.tracking) {
			await user.setCategoryWatchState(actor, id, categories.watchStates.tracking);
		}

		activitypub.send('cid', id, actor, {
			type: 'Accept',
			object: {
				type: 'Follow',
				actor,
				object,
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
		await db.sortedSetAdd(`followersRemote:${actor}`, now, uid); // for followers backreference
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

	let { type: localType, id } = await helpers.resolveLocalId(object.object);

	winston.info(`[activitypub/inbox/undo] ${type} ${localType && id ? `${localType} ${id}` : object.object} via ${actor}`);

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
					notifications.rescind(`follow:${id}:uid:${actor}`);
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

			const allowed = await privileges.posts.can('posts:upvote', id, activitypub._constants.uid);
			if (!allowed) {
				winston.info(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
				activitypub.send('uid', 0, actor, {
					type: 'Reject',
					object: {
						type: 'Like',
						actor,
						object,
					},
				});
				break;
			}

			await posts.unvote(id, actor);
			notifications.rescind(`upvote:post:${id}:uid:${actor}`);
			break;
		}

		case 'Announce': {
			id = id || object.object; // remote announces
			const exists = await posts.exists(id);
			if (!exists) {
				winston.verbose(`[activitypub/inbox/undo] Attempted to undo announce of ${id} but couldn't find it, so doing nothing.`);
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

			notifications.rescind(`announce:post:${id}:uid:${actor}`);
		}
	}
};
