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
const messaging = require('../messaging');
const flags = require('../flags');
const api = require('../api');
const activitypub = require('.');

const socketHelpers = require('../socket.io/helpers');
const helpers = require('./helpers');

const inbox = module.exports;

function reject(type, object, target, senderType = 'uid', id = 0) {
	activitypub.send(senderType, id, target, {
		id: `${helpers.resolveActor(senderType, id)}#/activity/reject/${encodeURIComponent(object.id)}`,
		type: 'Reject',
		object: {
			type,
			target,
			object,
		},
	}).catch(err => winston.error(err.stack));
}

inbox.create = async (req) => {
	const { object } = req.body;

	// Alternative logic for non-public objects
	const isPublic = [...(object.to || []), ...(object.cc || [])].includes(activitypub._constants.publicAddress);
	if (!isPublic) {
		return await activitypub.notes.assertPrivate(object);
	}

	const asserted = await activitypub.notes.assert(0, object);
	if (asserted) {
		activitypub.feps.announce(object.id, req.body);
		api.activitypub.add(req, { pid: object.id });
	}
};

inbox.add = async (req) => {
	const { actor, object, target } = req.body;

	// Only react on Adds pertaining to local posts
	const { type, id: pid } = await activitypub.helpers.resolveLocalId(object);
	if (type === 'post') {
		// Check context of OP
		const tid = await posts.getPostField(pid, 'tid');
		const context = await topics.getTopicField(tid, 'context');
		if (context) {
			const { attributedTo } = await activitypub.get('uid', 0, context);
			if (context === target && attributedTo === actor) {
				activitypub.helpers.log(`[activitypub/inbox/add] Associating pid ${pid} with new context ${target}`);
				await posts.setPostField(pid, 'context', target);
			}
		}
	}
};

inbox.update = async (req) => {
	const { actor, object } = req.body;
	const isPublic = [...(object.to || []), ...(object.cc || [])].includes(activitypub._constants.publicAddress);

	// Origin checking
	const actorHostname = new URL(actor).hostname;
	const objectHostname = new URL(object.id).hostname;
	if (actorHostname !== objectHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	switch (object.type) {
		case 'Note': {
			const [isNote, isMessage] = await Promise.all([
				posts.exists(object.id),
				messaging.messageExists(object.id),
			]);

			try {
				switch (true) {
					case isNote: {
						const postData = await activitypub.mocks.post(object);
						await posts.edit(postData);
						const isDeleted = await posts.getPostField(object.id, 'deleted');
						if (isDeleted) {
							await api.posts.restore({ uid: actor }, { pid: object.id });
						}
						break;
					}

					case isMessage: {
						const { roomId, deleted } = await messaging.getMessageFields(object.id, ['roomId', 'deleted']);
						await messaging.editMessage(actor, object.id, roomId, object.content);
						if (deleted) {
							await api.chats.restoreMessage({ uid: actor }, { mid: object.id });
						}
						break;
					}

					default: {
						if (!isPublic) {
							return await activitypub.notes.assertPrivate(object);
						}

						const asserted = await activitypub.notes.assert(0, object.id);
						if (asserted) {
							activitypub.feps.announce(object.id, req.body);
						}
						break;
					}
				}
			} catch (e) {
				reject('Update', object, actor);
			}
			break;
		}

		case 'Application': // falls through
		case 'Group': // falls through
		case 'Organization': // falls through
		case 'Service': // falls through
		case 'Person': {
			await activitypub.actors.assert(object.id, { update: true });
			break;
		}

		case 'Tombstone': {
			const [isNote, isMessage/* , isActor */] = await Promise.all([
				posts.exists(object.id),
				messaging.messageExists(object.id),
				// db.isSortedSetMember('usersRemote:lastCrawled', object.id),
			]);

			switch (true) {
				case isNote: {
					await api.posts.delete({ uid: actor }, { pid: object.id });
					break;
				}

				case isMessage: {
					await api.chats.deleteMessage({ uid: actor }, { mid: object.id });
					break;
				}

				// case isActor: {
				// console.log('actor');
				// break;
				// }
			}
		}
	}
};

inbox.delete = async (req) => {
	const { actor, object } = req.body;
	if (typeof object !== 'string') {
		const { id } = object;
		if (!id) {
			throw new Error('[[error:invalid-pid]]');
		}
	}
	const pid = object.id || object;
	let type = object.type || undefined;

	// Deletes don't have their objects resolved automatically
	let method = 'purge';
	try {
		if (!type) {
			({ type } = await activitypub.get('uid', 0, pid));
		}

		if (type === 'Tombstone') {
			method = 'delete';
		}
	} catch (e) {
		// probably 410/404
	}

	// Deletions must be made by an actor of the same origin
	const actorHostname = new URL(actor).hostname;

	const objectHostname = new URL(pid).hostname;
	if (actorHostname !== objectHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	const [isNote/* , isActor */] = await Promise.all([
		posts.exists(pid),
		// db.isSortedSetMember('usersRemote:lastCrawled', object.id),
	]);

	switch (true) {
		case isNote: {
			const uid = await posts.getPostField(pid, 'uid');
			await activitypub.feps.announce(pid, req.body);
			await api.posts[method]({ uid }, { pid });
			break;
		}

		// case isActor: {
		// console.log('actor');
		// break;
		// }

		default: {
			activitypub.helpers.log(`[activitypub/inbox.delete] Object (${pid}) does not exist locally. Doing nothing.`);
			break;
		}
	}
};

inbox.like = async (req) => {
	const { actor, object } = req.body;
	const { type, id } = await activitypub.helpers.resolveLocalId(object.id);

	if (type !== 'post' || !(await posts.exists(id))) {
		return reject('Like', object, actor);
	}

	const allowed = await privileges.posts.can('posts:upvote', id, activitypub._constants.uid);
	if (!allowed) {
		winston.verbose(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
		return reject('Like', object, actor);
	}

	winston.verbose(`[activitypub/inbox/like] id ${id} via ${actor}`);

	const result = await posts.upvote(id, actor);
	activitypub.feps.announce(object.id, req.body);
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

	const { cids } = await activitypub.actors.getLocalFollowers(actor);
	let cid = null;
	if (cids.size > 0) {
		cid = Array.from(cids)[0];
	}

	if (String(object.id).startsWith(nconf.get('url'))) { // Local object
		const { type, id } = await activitypub.helpers.resolveLocalId(object.id);
		if (type !== 'post' || !(await posts.exists(id))) {
			throw new Error('[[error:activitypub.invalid-id]]');
		}

		pid = id;
		tid = await posts.getPostField(id, 'tid');

		socketHelpers.sendNotificationToPostOwner(pid, actor, 'announce', 'notifications:activitypub.announce');
	} else { // Remote object
		// Follower check
		if (!cid) {
			const { followers } = await activitypub.actors.getLocalFollowCounts(actor);
			if (!followers) {
				winston.verbose(`[activitypub/inbox.announce] Rejecting ${object.id} via ${actor} due to no followers`);
				reject('Announce', object, actor);
				return;
			}
		}

		// Handle case where Announce(Create(Note-ish)) is received
		if (object.type === 'Create' && activitypub._constants.acceptedPostTypes.includes(object.object.type)) {
			pid = object.object.id;
		} else {
			pid = object.id;
		}

		pid = await activitypub.resolveId(0, pid); // in case wrong id is passed-in; unlikely, but still.
		if (!pid) {
			return;
		}

		const assertion = await activitypub.notes.assert(0, pid, { cid, skipChecks: true }); // checks skipped; done above.
		if (!assertion) {
			return;
		}

		({ tid } = assertion);
		await topics.updateLastPostTime(tid, timestamp);
		await activitypub.notes.updateLocalRecipients(pid, { to, cc });
		await activitypub.notes.syncUserInboxes(tid);
	}

	winston.verbose(`[activitypub/inbox/announce] Parsing id ${pid}`);

	if (!cid) { // Topic events from actors followed by users only
		await activitypub.notes.announce.add(pid, actor, timestamp);
	}
};

inbox.follow = async (req) => {
	const { actor, object, id: followId } = req.body;
	// Sanity checks
	const { type, id } = await helpers.resolveLocalId(object.id);
	if (!['category', 'user'].includes(type)) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}
	const handle = await user.getUserField(actor, 'username');

	if (type === 'user') {
		const [exists, allowed] = await Promise.all([
			user.exists(id),
			privileges.global.can('view:users', activitypub._constants.uid),
		]);
		if (!exists || !allowed) {
			throw new Error('[[error:invalid-uid]]');
		}

		const isFollowed = await inbox.isFollowed(actor, id);
		if (isFollowed) {
			// No additional parsing required
			return;
		}

		const now = Date.now();
		await db.sortedSetAdd(`followersRemote:${id}`, now, actor);
		await db.sortedSetAdd(`followingRemote:${actor}`, now, id); // for following backreference (actor pruning)

		const followerRemoteCount = await db.sortedSetCard(`followersRemote:${id}`);
		await user.setUserField(id, 'followerRemoteCount', followerRemoteCount);

		await user.onFollow(actor, id);
		activitypub.send('uid', id, actor, {
			id: `${nconf.get('url')}/${type}/${id}#activity/accept:follow/${handle}/${Date.now()}`,
			type: 'Accept',
			object: {
				id: followId,
				type: 'Follow',
				actor,
				object: object.id,
			},
		}).catch(err => winston.error(err.stack));
	} else if (type === 'category') {
		const [exists, allowed] = await Promise.all([
			categories.exists(id),
			privileges.categories.can('read', id, activitypub._constants.uid),
		]);
		if (!exists) {
			throw new Error('[[error:invalid-cid]]');
		}
		if (!allowed) {
			return reject('Follow', object, actor);
		}

		const watchState = await categories.getWatchState([id], actor);
		if (watchState[0] !== categories.watchStates.tracking) {
			await user.setCategoryWatchState(actor, id, categories.watchStates.tracking);
		}

		activitypub.send('cid', id, actor, {
			id: `${nconf.get('url')}/${type}/${id}#activity/accept:follow/${handle}/${Date.now()}`,
			type: 'Accept',
			object: {
				id: followId,
				type: 'Follow',
				actor,
				object: object.id,
			},
		}).catch(err => winston.error(err.stack));
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

	const { type: localType, id } = await helpers.resolveLocalId(object.actor);
	if (!['user', 'category'].includes(localType)) {
		throw new Error('[[error:invalid-data]]');
	}

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	if (type === 'Follow') {
		if (localType === 'user') {
			if (!await db.isSortedSetMember(`followRequests:uid.${id}`, actor)) {
				if (await db.isSortedSetMember(`followingRemote:${id}`, actor)) return; // already following
				return reject('Accept', req.body, actor); // not following, not requested, so reject to hopefully stop retries
			}
			const timestamp = await db.sortedSetScore(`followRequests:uid.${id}`, actor);
			await Promise.all([
				db.sortedSetRemove(`followRequests:uid.${id}`, actor),
				db.sortedSetAdd(`followingRemote:${id}`, timestamp, actor),
				db.sortedSetAdd(`followersRemote:${actor}`, timestamp, id), // for followers backreference and notes assertion checking
			]);
			const followingRemoteCount = await db.sortedSetCard(`followingRemote:${id}`);
			await user.setUserField(id, 'followingRemoteCount', followingRemoteCount);
		} else if (localType === 'category') {
			if (!await db.isSortedSetMember(`followRequests:cid.${id}`, actor)) {
				if (await db.isSortedSetMember(`cid:${id}:following`, actor)) return; // already following
				return reject('Accept', req.body, actor); // not following, not requested, so reject to hopefully stop retries
			}
			const timestamp = await db.sortedSetScore(`followRequests:cid.${id}`, actor);
			await Promise.all([
				db.sortedSetRemove(`followRequests:cid.${id}`, actor),
				db.sortedSetAdd(`cid:${id}:following`, timestamp, actor),
				db.sortedSetAdd(`followersRemote:${actor}`, timestamp, `cid|${id}`), // for notes assertion checking
			]);
		}
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

	winston.verbose(`[activitypub/inbox/undo] ${type} ${localType && id ? `${localType} ${id}` : object.object} via ${actor}`);

	switch (type) {
		case 'Follow': {
			switch (localType) {
				case 'user': {
					const exists = await user.exists(id);
					if (!exists) {
						throw new Error('[[error:invalid-uid]]');
					}

					await Promise.all([
						db.sortedSetRemove(`followersRemote:${id}`, actor),
						db.sortedSetRemove(`followingRemote:${actor}`, id),
					]);
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
				winston.verbose(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
				reject('Like', object, actor);
				break;
			}

			await posts.unvote(id, actor);
			activitypub.feps.announce(object.object, req.body);
			notifications.rescind(`upvote:post:${id}:uid:${actor}`);
			break;
		}

		case 'Announce': {
			id = id || object.object; // remote announces
			const exists = await posts.exists(id);
			if (!exists) {
				activitypub.helpers.log(`[activitypub/inbox/undo] Attempted to undo announce of ${id} but couldn't find it, so doing nothing.`);
				break;
			}

			await activitypub.notes.announce.remove(id, actor);
			notifications.rescind(`announce:post:${id}:uid:${actor}`);
			break;
		}
		case 'Flag': {
			if (!Array.isArray(object.object)) {
				object.object = [object.object];
			}
			await Promise.all(object.object.map(async (subject) => {
				const { type, id } = await activitypub.helpers.resolveLocalId(subject.id);
				try {
					await flags.rescindReport(type, id, actor);
				} catch (e) {
					reject('Undo', { type: 'Flag', object: [subject] }, actor);
				}
			}));
			break;
		}
	}
};
inbox.flag = async (req) => {
	const { actor, object, content } = req.body;
	const objects = Array.isArray(object) ? object : [object];

	// Check if the actor is valid
	if (!await activitypub.actors.assert(actor)) {
		return reject('Flag', objects, actor);
	}

	await Promise.all(objects.map(async (subject, index) => {
		const { type, id } = await activitypub.helpers.resolveObjects(subject.id);
		try {
			await flags.create(activitypub.helpers.mapToLocalType(type), id, actor, content);
		} catch (e) {
			reject('Flag', objects[index], actor);
		}
	}));
};

inbox.reject = async (req) => {
	const { actor, object } = req.body;
	const { type, id } = object;
	const { hostname } = new URL(actor);
	const queueId = `${type}:${id}:${hostname}`;

	// stop retrying rejected requests
	clearTimeout(activitypub.retryQueue.get(queueId));
	activitypub.retryQueue.delete(queueId);
};
