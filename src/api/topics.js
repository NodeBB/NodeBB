'use strict';

const user = require('../user');
const topics = require('../topics');
const categories = require('../categories');
const posts = require('../posts');
const meta = require('../meta');
const privileges = require('../privileges');
const events = require('../events');
const batch = require('../batch');
const activitypub = require('../activitypub');
const utils = require('../utils');

const apiHelpers = require('./helpers');

const { doTopicAction } = apiHelpers;

const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');

const topicsAPI = module.exports;

topicsAPI._checkThumbPrivileges = async function ({ tid, uid }) {
	// Sanity-check the tid if it's strictly not a uuid
	if ((isNaN(parseInt(tid, 10)) || !await topics.exists(tid))) {
		throw new Error('[[error:no-topic]]');
	}

	// While drafts are not protected, tids are
	if (!await privileges.topics.canEdit(tid, uid)) {
		throw new Error('[[error:no-privileges]]');
	}
};

topicsAPI.get = async function (caller, data) {
	const [userPrivileges, topic] = await Promise.all([
		privileges.topics.get(data.tid, caller.uid),
		topics.getTopicData(data.tid),
	]);
	if (
		!topic ||
		!userPrivileges.read ||
		!userPrivileges['topics:read'] ||
		!privileges.topics.canViewDeletedScheduled(topic, userPrivileges)
	) {
		return null;
	}

	return topic;
};

topicsAPI.create = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const payload = { ...data };
	delete payload.tid;
	payload.tags = payload.tags || [];
	apiHelpers.setDefaultPostData(caller, payload);
	const isScheduling = parseInt(data.timestamp, 10) > payload.timestamp;
	if (isScheduling) {
		if (await privileges.categories.can('topics:schedule', data.cid, caller.uid)) {
			payload.timestamp = parseInt(data.timestamp, 10);
		} else {
			throw new Error('[[error:no-privileges]]');
		}
	}

	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		return await posts.addToQueue(payload);
	}

	const result = await topics.post(payload);

	socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
	socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

	if (!isScheduling) {
		await activitypub.out.create.note(caller.uid, result.postData.pid);
	}

	return result.topicData;
};

topicsAPI.reply = async function (caller, data) {
	if (!data || !data.tid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}
	const payload = { ...data };
	delete payload.pid;
	apiHelpers.setDefaultPostData(caller, payload);

	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		return await posts.addToQueue(payload);
	}

	const postData = await topics.reply(payload);

	const result = {
		posts: [postData],
		'reputation:disabled': meta.config['reputation:disabled'] === 1,
		'downvote:disabled': meta.config['downvote:disabled'] === 1,
	};

	user.updateOnlineUsers(caller.uid);
	if (caller.uid) {
		socketHelpers.emitToUids('event:new_post', result, [caller.uid]);
	} else if (caller.uid === 0) {
		websockets.in('online_guests').emit('event:new_post', result);
	}

	socketHelpers.notifyNew(caller.uid, 'newPost', result);
	await activitypub.out.create.note(caller.uid, postData);

	return postData;
};

topicsAPI.delete = async function (caller, data) {
	await doTopicAction('delete', 'event:topic_deleted', caller, {
		tids: data.tids,
	});
};

topicsAPI.restore = async function (caller, data) {
	await doTopicAction('restore', 'event:topic_restored', caller, {
		tids: data.tids,
	});
};

topicsAPI.purge = async function (caller, data) {
	await doTopicAction('purge', 'event:topic_purged', caller, {
		tids: data.tids,
	});
};

topicsAPI.pin = async function (caller, { tids, expiry }) {
	await doTopicAction('pin', 'event:topic_pinned', caller, { tids });

	if (expiry) {
		await Promise.all(tids.map(async tid => topics.tools.setPinExpiry(tid, expiry, caller.uid)));
	}
};

topicsAPI.unpin = async function (caller, data) {
	await doTopicAction('unpin', 'event:topic_unpinned', caller, {
		tids: data.tids,
	});
};

topicsAPI.lock = async function (caller, data) {
	await doTopicAction('lock', 'event:topic_locked', caller, {
		tids: data.tids,
	});
};

topicsAPI.unlock = async function (caller, data) {
	await doTopicAction('unlock', 'event:topic_unlocked', caller, {
		tids: data.tids,
	});
};

topicsAPI.follow = async function (caller, data) {
	await topics.follow(data.tid, caller.uid);
};

topicsAPI.ignore = async function (caller, data) {
	await topics.ignore(data.tid, caller.uid);
};

topicsAPI.unfollow = async function (caller, data) {
	await topics.unfollow(data.tid, caller.uid);
};

topicsAPI.updateTags = async (caller, { tid, tags }) => {
	if (!await privileges.topics.canEdit(tid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const cid = await topics.getTopicField(tid, 'cid');
	await topics.validateTags(tags, cid, caller.uid, tid);
	await topics.updateTopicTags(tid, tags);
	return await topics.getTopicTagsObjects(tid);
};

topicsAPI.addTags = async (caller, { tid, tags }) => {
	if (!await privileges.topics.canEdit(tid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const cid = await topics.getTopicField(tid, 'cid');
	await topics.validateTags(tags, cid, caller.uid, tid);
	tags = await topics.filterTags(tags, cid);

	await topics.addTags(tags, [tid]);
	return await topics.getTopicTagsObjects(tid);
};

topicsAPI.deleteTags = async (caller, { tid }) => {
	if (!await privileges.topics.canEdit(tid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	await topics.deleteTopicTags(tid);
};

topicsAPI.getThumbs = async (caller, { tid, thumbsOnly }) => {
	if (isFinite(tid)) { // post_uuids can be passed in occasionally, in that case no checks are necessary
		const [exists, canRead] = await Promise.all([
			topics.exists(tid),
			privileges.topics.can('topics:read', tid, caller.uid),
		]);
		if (!exists) {
			throw new Error('[[error:not-found]]');
		}
		if (!canRead) {
			throw new Error('[[error:not-allowed]]');
		}
	}

	return await topics.thumbs.get(tid, { thumbsOnly });
};

topicsAPI.deleteThumb = async (caller, { tid, path }) => {
	await topicsAPI._checkThumbPrivileges({ tid: tid, uid: caller.uid });
	await topics.thumbs.delete(tid, path);
};

topicsAPI.reorderThumbs = async (caller, { tid, path, order }) => {
	await topicsAPI._checkThumbPrivileges({ tid: tid, uid: caller.uid });

	const exists = await topics.thumbs.exists(tid, path);
	if (!exists) {
		throw new Error('[[error:invalid-data]]');
	}

	await topics.thumbs.associate({
		id: tid,
		path: path,
		score: order,
	});
};

topicsAPI.getEvents = async (caller, { tid }) => {
	if (!await privileges.topics.can('topics:read', tid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	return await topics.events.get(tid, caller.uid);
};

topicsAPI.deleteEvent = async (caller, { tid, eventId }) => {
	if (!await privileges.topics.isAdminOrMod(tid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	await topics.events.purge(tid, [eventId]);
};

topicsAPI.markRead = async (caller, { tid }) => {
	const hasMarked = await topics.markAsRead([tid], caller.uid);
	const promises = [topics.markTopicNotificationsRead([tid], caller.uid)];
	if (hasMarked) {
		promises.push(topics.pushUnreadCount(caller.uid));
	}
	await Promise.all(promises);
};

topicsAPI.markUnread = async (caller, { tid }) => {
	if (!tid || caller.uid <= 0) {
		throw new Error('[[error:invalid-data]]');
	}
	await topics.markUnread(tid, caller.uid);
	topics.pushUnreadCount(caller.uid);
};

topicsAPI.bump = async (caller, { tid }) => {
	if (!tid) {
		throw new Error('[[error:invalid-tid]]');
	}
	const isAdminOrMod = await privileges.topics.isAdminOrMod(tid, caller.uid);
	if (!isAdminOrMod) {
		throw new Error('[[error:no-privileges]]');
	}

	await topics.markAsUnreadForAll(tid);
	topics.pushUnreadCount(caller.uid);
};

topicsAPI.move = async (caller, { tid, cid }) => {
	const canMove = await privileges.categories.isAdminOrMod(cid, caller.uid);
	if (!canMove) {
		throw new Error('[[error:no-privileges]]');
	}

	const tids = Array.isArray(tid) ? tid : [tid];
	const uids = await user.getUidsFromSet('users:online', 0, -1);
	const cids = [parseInt(cid, 10)];

	await batch.processArray(tids, async (tids) => {
		await Promise.all(tids.map(async (tid) => {
			const canMove = await privileges.topics.isAdminOrMod(tid, caller.uid);
			if (!canMove) {
				throw new Error('[[error:no-privileges]]');
			}
			const topicData = await topics.getTopicFields(tid, ['tid', 'cid', 'mainPid', 'slug', 'deleted']);
			topicData.toCid = cid;
			if (!cids.includes(topicData.cid)) {
				cids.push(topicData.cid);
			}
			await topics.tools.move(tid, {
				cid,
				uid: caller.uid,
			});

			const notifyUids = await privileges.categories.filterUids('topics:read', topicData.cid, uids);
			socketHelpers.emitToUids('event:topic_moved', topicData, notifyUids);
			if (!topicData.deleted) {
				socketHelpers.sendNotificationToTopicOwner(tid, caller.uid, 'move', 'notifications:moved-your-topic');

				if (utils.isNumber(cid) && parseInt(cid, 10) === -1) {
					activitypub.out.remove.context(caller.uid, tid); // 7888-style
					activitypub.out.delete.note(caller.uid, topicData.mainPid); // 1b12-style
				} else {
					activitypub.out.move.context(caller.uid, tid);
					activitypub.out.announce.topic(tid);
				}
				activitypub.out.undo.announce('cid', topicData.cid, tid); // microblogs
			}

			await events.log({
				type: `topic-move`,
				uid: caller.uid,
				ip: caller.ip,
				tid: tid,
				fromCid: topicData.cid,
				toCid: cid,
			});
		}));
	}, { batch: 10 });

	await categories.onTopicsMoved(cids);
};
