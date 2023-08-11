'use strict';

const validator = require('validator');

const user = require('../user');
const topics = require('../topics');
const posts = require('../posts');
const meta = require('../meta');
const privileges = require('../privileges');

const apiHelpers = require('./helpers');

const { doTopicAction } = apiHelpers;

const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');

const topicsAPI = module.exports;

topicsAPI._checkThumbPrivileges = async function ({ tid, uid }) {
	// req.params.tid could be either a tid (pushing a new thumb to an existing topic)
	// or a post UUID (a new topic being composed)
	const isUUID = validator.isUUID(tid);

	// Sanity-check the tid if it's strictly not a uuid
	if (!isUUID && (isNaN(parseInt(tid, 10)) || !await topics.exists(tid))) {
		throw new Error('[[error:no-topic]]');
	}

	// While drafts are not protected, tids are
	if (!isUUID && !await privileges.topics.canEdit(tid, uid)) {
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
	await topics.thumbs.migrate(data.uuid, result.topicData.tid);

	socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
	socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

	return result.topicData;
};

topicsAPI.reply = async function (caller, data) {
	if (!data || !data.tid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}
	const payload = { ...data };
	apiHelpers.setDefaultPostData(caller, payload);

	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		return await posts.addToQueue(payload);
	}

	const postData = await topics.reply(payload); // postData seems to be a subset of postObj, refactor?
	const postObj = await posts.getPostSummaryByPids([postData.pid], caller.uid, {});

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

	return postObj[0];
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

topicsAPI.getThumbs = async (caller, { tid }) => {
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

	return await topics.thumbs.get(tid);
};

// topicsAPI.addThumb

topicsAPI.migrateThumbs = async (caller, { from, to }) => {
	await Promise.all([
		topicsAPI._checkThumbPrivileges({ tid: from, uid: caller.uid }),
		topicsAPI._checkThumbPrivileges({ tid: to, uid: caller.uid }),
	]);

	await topics.thumbs.migrate(from, to);
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
