'use strict';

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

	// Blacklist & Post Queue
	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return queueObj;
	}

	const result = await topics.post(payload);
	await topics.thumbs.migrate(data.uuid, result.topicData.tid);

	socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
	socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

	return result.topicData;
};

topicsAPI.reply = async function (caller, data) {
	const payload = { ...data };
	apiHelpers.setDefaultPostData(caller, payload);

	// Blacklist & Post Queue
	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return queueObj;
	}

	const postData = await topics.reply(payload);	// postData seems to be a subset of postObj, refactor?
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

topicsAPI.pin = async function (caller, data) {
	await doTopicAction('pin', 'event:topic_pinned', caller, {
		tids: data.tids,
	});
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
