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
const utils = require('../utils');
const activitypub = require('.');

const socketHelpers = require('../socket.io/helpers');
const helpers = require('./helpers');

const inbox = module.exports;

function publiclyAddressed(recipients) {
	return activitypub._constants.acceptablePublicAddresses.some(address => recipients.includes(address));
}

inbox._reject = function (type, object, target, senderType = 'uid', id = 0) {
	activitypub.send(senderType, id, target, {
		id: `${helpers.resolveActor(senderType, id)}#/activity/reject/${encodeURIComponent(object.id)}`,
		type: 'Reject',
		object: {
			type,
			target,
			object,
		},
	}).catch(err => winston.error(err.stack));
};

inbox.create = async (req) => {
	const { object, actor } = req.body;

	// Alternative logic for non-public objects
	const isPublic = publiclyAddressed([...(object.to || []), ...(object.cc || [])]);
	if (!isPublic) {
		return await activitypub.notes.assertPrivate(object);
	}

	// Category sync, remove when cross-posting available
	const { cids } = await activitypub.actors.getFollowers(actor);
	let cid = null;
	if (cids.size > 0) {
		cid = Array.from(cids)[0];
	}

	const asserted = await activitypub.notes.assert(0, object, { cid });
	if (asserted) {
		await activitypub.feps.announce(object.id, req.body);
		// api.activitypub.add(req, { pid: object.id });
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

inbox.remove = async (req) => {
	const { actor, object, target } = req.body;

	const isContext = activitypub._constants.acceptable.contextTypes.has(object.type);
	if (!isContext) {
		return; // don't know how to handle other types
	}

	const mainPid = await activitypub.contexts.getItems(0, object.id, { returnRootId: true });
	const fromCid = target || object.audience;
	const exists = await posts.exists(mainPid);
	if (!exists || !fromCid) {
		return; // post not cached; do nothing.
	}

	// Ensure that cid is same-origin as the actor
	const tid = await posts.getPostField(mainPid, 'tid');
	const cid = await topics.getTopicField(tid, 'cid');
	if (utils.isNumber(cid) || cid !== fromCid) {
		// remote removal of topic in local cid, or resolved cid does not match
		return;
	}
	const actorHostname = new URL(actor).hostname;
	const cidHostname = new URL(cid).hostname;
	if (actorHostname !== cidHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	activitypub.helpers.log(`[activitypub/inbox/remove] Removing topic ${tid} from ${cid}`);
	await topics.tools.move(tid, {
		cid: -1,
		uid: 'system',
	});
};

inbox.move = async (req) => {
	const { actor, object, origin, target } = req.body;

	const isContext = activitypub._constants.acceptable.contextTypes.has(object.type);
	if (!isContext) {
		return; // don't know how to handle other types
	}

	const mainPid = await activitypub.contexts.getItems(0, object.id, { returnRootId: true });
	const fromCid = origin;
	const toCid = target || object.audience;
	const exists = await posts.exists(mainPid);
	if (!exists || !toCid) {
		return; // post not cached; do nothing.
	}

	// Ensure that cid is same-origin as the actor
	const tid = await posts.getPostField(mainPid, 'tid');
	const cid = await topics.getTopicField(tid, 'cid');
	if (utils.isNumber(cid)) {
		// remote removal of topic in local cid, or resolved cid does not match
		return;
	}
	const actorHostname = new URL(actor).hostname;
	const toCidHostname = new URL(toCid).hostname;
	const fromCidHostname = new URL(fromCid).hostname;
	if (actorHostname !== toCidHostname || actorHostname !== fromCidHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	activitypub.helpers.log(`[activitypub/inbox/remove] Moving topic ${tid} from ${fromCid} to ${toCid}`);
	await topics.tools.move(tid, {
		cid: toCid,
		uid: 'system',
	});
};

inbox.update = async (req) => {
	const { actor, object } = req.body;
	const isPublic = publiclyAddressed([...(object.to || []), ...(object.cc || [])]);

	// Origin checking
	const actorHostname = new URL(actor).hostname;
	const objectHostname = new URL(object.id).hostname;
	if (actorHostname !== objectHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	switch (true) {
		case activitypub._constants.acceptedPostTypes.includes(object.type): {
			const [isNote, isMessage] = await Promise.all([
				posts.exists(object.id),
				messaging.messageExists(object.id),
			]);

			switch (true) {
				case isNote: {
					const cid = await posts.getCidByPid(object.id);
					const allowed = await privileges.categories.can('posts:edit', cid, activitypub._constants.uid);
					if (!allowed) {
						throw new Error('[[error:no-privileges]]');
					}

					const postData = await activitypub.mocks.post(object);
					postData.tags = await activitypub.notes._normalizeTags(postData._activitypub.tag, postData.cid);
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

					const { cids } = await activitypub.actors.getFollowers(actor);
					let cid = null;
					if (cids.size > 0) {
						cid = Array.from(cids)[0];
					}

					const asserted = await activitypub.notes.assert(0, object.id, { cid });
					if (asserted) {
						activitypub.feps.announce(object.id, req.body);
					}
					break;
				}
			}
			break;
		}

		case activitypub._constants.acceptableActorTypes.has(object.type): {
			await activitypub.actors.assert(object.id, { update: true });
			break;
		}

		case object.type === 'Tombstone': {
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
	const id = object.id || object;
	let type = object.type || undefined;

	// Deletes don't have their objects resolved automatically
	let method = 'purge';
	try {
		if (!type) {
			({ type } = await activitypub.get('uid', 0, id));
		}

		if (type === 'Tombstone') {
			method = 'delete'; // soft delete
		}
	} catch (e) {
		// probably 410/404
	}

	// Deletions must be made by an actor of the same origin
	const actorHostname = new URL(actor).hostname;

	const objectHostname = new URL(id).hostname;
	if (actorHostname !== objectHostname) {
		throw new Error('[[error:activitypub.origin-mismatch]]');
	}

	const [isNote, isContext/* , isActor */] = await Promise.all([
		posts.exists(id),
		activitypub.contexts.getItems(0, id, { returnRootId: true }), // ⚠️ unreliable, needs better logic (Contexts.is?)
		// db.isSortedSetMember('usersRemote:lastCrawled', object.id),
	]);

	switch (true) {
		case isNote: {
			const cid = await posts.getCidByPid(id);
			const allowed = await privileges.categories.can('posts:edit', cid, activitypub._constants.uid);
			if (!allowed) {
				throw new Error('[[error:no-privileges]]');
			}

			const uid = await posts.getPostField(id, 'uid');
			await activitypub.feps.announce(id, req.body);
			try {
				await api.posts[method]({ uid }, { pid: id });
			} catch (e) {
				// Can ignore deletion if already deleted
				if (e.message !== '[[error:post-already-deleted]]') {
					throw e;
				}
			}
			break;
		}

		case !!isContext: {
			const pid = isContext;
			const exists = await posts.exists(pid);
			if (!exists) {
				activitypub.helpers.log(`[activitypub/inbox.delete] Context main pid (${pid}) not found locally. Doing nothing.`);
				return;
			}
			const { tid, uid } = await posts.getPostFields(pid, ['tid', 'uid']);
			activitypub.helpers.log(`[activitypub/inbox.delete] Deleting tid ${tid}.`);
			await api.topics[method]({ uid }, { tids: [tid] });
			break;
		}

		// case isActor: {
		// console.log('actor');
		// break;
		// }

		default: {
			activitypub.helpers.log(`[activitypub/inbox.delete] Object (${id}) does not exist locally. Doing nothing.`);
			break;
		}
	}
};

inbox.like = async (req) => {
	const { actor, object } = req.body;

	let exists;
	let id;
	if (object.id.startsWith(nconf.get('url'))) {
		const { type, id: _id } = await activitypub.helpers.resolveLocalId(object.id);
		if (type === 'post') {
			exists = await posts.exists(_id);
			id = _id;
		}
	} else {
		exists = await posts.exists(object.id);
		if (!exists) {
			// Proactively pull in the note
			const asserted = await activitypub.notes.assert(0, object.id, { skipChecks: 1 });
			if (!asserted) {
				throw new Error('[[error:invalid-pid]]');
			}
			exists = true;
		}
		id = object.id;
	}
	if (!id || !exists) {
		throw new Error('[[error:invalid-pid]]');
	}

	const allowed = await privileges.posts.can('posts:upvote', id, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
		throw new Error('[[error:no-privileges]]');
	}

	activitypub.helpers.log(`[activitypub/inbox/like] id ${id} via ${actor}`);

	const result = await posts.upvote(id, actor);
	await activitypub.feps.announce(object.id, req.body);
	socketHelpers.upvote(result, 'notifications:upvoted-your-post-in');
};

inbox.dislike = async (req) => {
	const { actor, object } = req.body;
	const { type, id } = await activitypub.helpers.resolveLocalId(object.id);

	if (type !== 'post' || !(await posts.exists(id))) {
		throw new Error('[[error:invalid-pid]]');
	}

	const allowed = await privileges.posts.can('posts:downvote', id, activitypub._constants.uid);
	if (!allowed) {
		activitypub.helpers.log(`[activitypub/inbox.like] ${id} not allowed to be downvoted.`);
		throw new Error('[[error:no-privileges]]');
	}

	activitypub.helpers.log(`[activitypub/inbox/dislike] id ${id} via ${actor}`);

	await posts.downvote(id, actor);
	await activitypub.feps.announce(object.id, req.body);
};

inbox.announce = async (req) => {
	let { actor, object, published, to, cc } = req.body;
	activitypub.helpers.log(`[activitypub/inbox/announce] Parsing Announce(${object.type}) from ${actor}`);
	let timestamp = new Date(published);
	timestamp = timestamp.toString() !== 'Invalid Date' ? timestamp.getTime() : Date.now();

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	let tid;
	let pid;

	// Category sync, remove when cross-posting available
	const { cids } = await activitypub.actors.getFollowers(actor);
	const syncedCids = Array.from(cids);

	// 1b12 announce
	let cid = null;
	const categoryActor = await categories.exists(actor);
	if (categoryActor) {
		cid = actor;
	}

	// Received via relay?
	const fromRelay = await activitypub.relays.is(actor);

	switch(true) {
		case object.type === 'Like': {
			const id = object.object.id || object.object;
			const { id: localId } = await activitypub.helpers.resolveLocalId(id);
			const exists = await posts.exists(localId || id);
			if (exists) {
				try {
					await activitypub.actors.assert(object.actor);
					const result = await posts.upvote(localId || id, object.actor);
					if (localId) {
						socketHelpers.upvote(result, 'notifications:upvoted-your-post-in');
					}
				} catch (e) {
					// vote denied due to local limitations (frequency, privilege, etc.); noop.
				}
			}

			break;
		}

		case object.type === 'Update': {
			req.body = object;
			await inbox.update(req);
			break;
		}

		case object.type === 'Delete': {
			let id = object.object.id || object.object; // expecting object reference
			const { id: localId } = await activitypub.helpers.resolveLocalId(id);
			id = localId || id;

			const exists = await posts.exists(id);
			if (!exists) {
				activitypub.helpers.log(`[activitypub/inbox.announce] Object (${id}) does not exist locally. Doing nothing.`);
				break;
			}

			const _cid = await posts.getCidByPid(id);
			if (!utils.isNumber(cid) && _cid !== cid) { // matching & remote categories only
				throw new Error('[[error:invalid-cid]]');
			}

			const uid = await posts.getPostField(id, 'uid');
			await posts.delete(id, uid);
			break;
		}

		case object.type === 'Create': {
			object = object.object;
			// falls through
		}

		// Announce(Object)
		case activitypub._constants.acceptedPostTypes.includes(object.type): {
			if (String(object.id).startsWith(nconf.get('url'))) { // Local object
				const { type, id } = await activitypub.helpers.resolveLocalId(object.id);
				if (type !== 'post' || !(await posts.exists(id))) {
					throw new Error('[[error:invalid-pid]]');
				}

				pid = id;
				tid = await posts.getPostField(id, 'tid');

				socketHelpers.sendNotificationToPostOwner(pid, actor, 'announce', 'notifications:activitypub.announce');
			} else { // Remote object
				// Follower check
				if (!fromRelay && !cid && !syncedCids.length) {
					const { followers } = await activitypub.actors.getLocalFollowCounts(actor);
					if (!followers) {
						activitypub.helpers.log(`[activitypub/inbox.announce] Rejecting ${object.id} via ${actor} due to no followers`);
						throw new Error('[[error:activitypub.orphan]]');
					}
				}

				pid = object.id;
				pid = await activitypub.resolveId(0, pid); // in case wrong id is passed-in; unlikely, but still.
				if (!pid) {
					return;
				}

				const assertion = await activitypub.notes.assert(0, pid, { cid, skipChecks: true });
				if (!assertion) {
					return;
				}

				({ tid } = assertion);
				await activitypub.notes.updateLocalRecipients(pid, { to, cc });
				await activitypub.notes.syncUserInboxes(tid);

				if (syncedCids) {
					await Promise.all(syncedCids.map(async (cid) => {
						await topics.crossposts.add(tid, cid, 0);
					}));
				}

				if (fromRelay) {
					activitypub.analytics.relays.in(actor);
				}
			}

			if (!cid) { // Topic events from actors followed by users only
				await activitypub.notes.announce.add(pid, actor, timestamp);
			}
		}
	}
};

inbox.follow = async (req) => {
	const { actor, object, id: followId } = req.body;

	// Sanity checks
	const { type, id } = await helpers.resolveLocalId(object.id);
	if (type === 'application') {
		return activitypub.relays.handshake(req.body);
	} else if (!['category', 'user'].includes(type)) {
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
		await Promise.all([
			db.sortedSetAdd(`followersRemote:${id}`, now, actor),
			db.sortedSetAdd(`followingRemote:${actor}`, now, id), // for following backreference (actor pruning)
			user.syncFollowCounts(id, false, true),
			user.syncFollowCounts(actor, true, false),
		]);
		activitypub.actors._followerCache.del(id);

		await user.onFollow(actor, id);
		activitypub.send('uid', id, actor, {
			id: `${nconf.get('url')}/${type}/${id}#activity/accept:follow/${handle}/${Date.now()}`,
			type: 'Accept',
			to: [actor],
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
			throw new Error('[[error:no-privileges]]');
		}

		const watchState = await categories.getWatchState([id], actor);
		if (watchState[0] !== categories.watchStates.tracking) {
			await user.setCategoryWatchState(actor, id, categories.watchStates.tracking);
		}

		activitypub.send('cid', id, actor, {
			id: `${nconf.get('url')}/${type}/${id}#activity/accept:follow/${handle}/${Date.now()}`,
			type: 'Accept',
			to: [actor],
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
	if (object.id === `${nconf.get('url')}/actor`) {
		return activitypub.relays.handshake(req.body);
	} else if (!['user', 'category'].includes(localType)) {
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
				throw new Error('[[error:invalid-data]]'); // not following, not requested, so reject to hopefully stop retries
			}
			const timestamp = await db.sortedSetScore(`followRequests:uid.${id}`, actor);
			await Promise.all([
				db.sortedSetRemove(`followRequests:uid.${id}`, actor),
				db.sortedSetAdd(`followingRemote:${id}`, timestamp, actor),
				db.sortedSetAdd(`followersRemote:${actor}`, timestamp, id), // for followers backreference and notes assertion checking
			]);
			await user.syncFollowCounts(id, true, false);
			await user.syncFollowCounts(actor, false, true);
		} else if (localType === 'category') {
			if (!await db.isSortedSetMember(`followRequests:cid.${id}`, actor)) {
				if (await db.isSortedSetMember(`cid:${id}:following`, actor)) return; // already following
				throw new Error('[[error:invalid-data]]'); // not following, not requested, so reject to hopefully stop retries
			}
			const timestamp = await db.sortedSetScore(`followRequests:cid.${id}`, actor);
			await Promise.all([
				db.sortedSetRemove(`followRequests:cid.${id}`, actor),
				db.sortedSetAdd(`cid:${id}:following`, timestamp, actor),
				db.sortedSetAdd(`followersRemote:${actor}`, timestamp, `cid|${id}`), // for notes assertion checking
			]);
		}

		activitypub.actors._followerCache.del(actor);
	}
};

inbox.undo = async (req) => {
	// todo: "actor" in this case should be the one in object, no?
	const { actor, object } = req.body;
	const { type } = object;

	const assertion = await activitypub.actors.assert(actor);
	if (!assertion) {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	let { type: localType, id } = await helpers.resolveLocalId(object.object);

	activitypub.helpers.log(`[activitypub/inbox/undo] ${type} ${localType && id ? `${localType} ${id}` : object.object} via ${actor}`);

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
						user.syncFollowCounts(id, false, true),
						user.syncFollowCounts(actor, true, false),
					]);
					notifications.rescind(`follow:${id}:uid:${actor}`);
					activitypub.actors._followerCache.del(id);
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
				activitypub.helpers.log(`[activitypub/inbox.like] ${id} not allowed to be upvoted.`);
				throw new Error('[[error:no-privileges]]');
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
					inbox._reject('Undo', { type: 'Flag', object: [subject] }, actor);
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
		throw new Error('[[error:invalid-data]]');
	}

	await Promise.all(objects.map(async (subject, index) => {
		const { type, id } = await activitypub.helpers.resolveObjects(subject.id);
		try {
			await flags.create(activitypub.helpers.mapToLocalType(type), id, actor, content);
		} catch (e) {
			inbox._reject('Flag', objects[index], actor);
		}
	}));
};

inbox.reject = async (req) => {
	const { actor, object } = req.body;
	const { type, id } = object;
	const { hostname } = new URL(actor);
	const queueId = `${type}:${id}:${hostname}`;

	// stop retrying rejected requests
	await Promise.all([
		db.sortedSetRemove('ap:retry:queue', queueId),
		db.delete(`ap:retry:queue:${queueId}`),
	]);
};
