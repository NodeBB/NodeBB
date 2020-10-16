'use strict';

const user = require('../user');
const topics = require('../topics');
const posts = require('../posts');
const meta = require('../meta');
const events = require('../events');
const privileges = require('../privileges');

const controllerHelpers = require('../controllers/helpers');
const socketHelpers = require('../socket.io/helpers');

const topicsAPI = module.exports;

topicsAPI.create = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const payload = { ...data };
	payload.tags = payload.tags || [];
	payload.uid = caller.uid;
	payload.uid = caller.uid;
	payload.req = controllerHelpers.buildReqObject(caller);
	payload.timestamp = Date.now();
	payload.fromQueue = false;

	// Blacklist & Post Queue
	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return queueObj;
	}

	const result = await topics.post(payload);

	socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
	socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

	return result.topicData;
};

topicsAPI.reply = async function (caller, data) {
	var payload = {
		tid: data.tid,
		uid: caller.uid,
		req: controllerHelpers.buildReqObject(caller),	// For IP recording
		content: data.content,
		timestamp: data.timestamp,
		fromQueue: false,
	};

	if (data.toPid) { payload.toPid = data.toPid; }

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
	socketHelpers.emitToUids('event:new_post', result, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newPost', result);

	return postObj[0];
};

topicsAPI.delete = async function (caller, data) {
	await doTopicAction('delete', 'event:topic_deleted', caller, {
		tids: [data.tid],
	});
};

topicsAPI.restore = async function (caller, data) {
	await doTopicAction('restore', 'event:topic_restored', caller, {
		tids: [data.tid],
	});
};

topicsAPI.purge = async function (caller, data) {
	await doTopicAction('purge', 'event:topic_purged', caller, {
		tids: [data.tid],
	});
};

topicsAPI.pin = async function (caller, data) {
	await doTopicAction('pin', 'event:topic_pinned', caller, {
		tids: [data.tid],
	});
};

topicsAPI.unpin = async function (caller, data) {
	await doTopicAction('unpin', 'event:topic_unpinned', caller, {
		tids: [data.tid],
	});
};

topicsAPI.lock = async function (caller, data) {
	await doTopicAction('lock', 'event:topic_locked', caller, {
		tids: [data.tid],
	});
};

topicsAPI.unlock = async function (caller, data) {
	await doTopicAction('unlock', 'event:topic_unlocked', caller, {
		tids: [data.tid],
	});
};

async function doTopicAction(action, event, caller, { tids }) {
	if (!Array.isArray(tids)) {
		throw new Error('[[error:invalid-tid]]');
	}

	const exists = (await Promise.all(tids.map(async tid => await topics.exists(tid)))).every(Boolean);
	if (!exists) {
		throw new Error('[[error:no-topic]]');
	}

	if (typeof topics.tools[action] !== 'function') {
		return;
	}

	const uids = await user.getUidsFromSet('users:online', 0, -1);

	await Promise.all(tids.map(async function (tid) {
		const title = await topics.getTopicField(tid, 'title');
		const data = await topics.tools[action](tid, caller.uid);
		const notifyUids = await privileges.categories.filterUids('topics:read', data.cid, uids);
		socketHelpers.emitToUids(event, data, notifyUids);
		await logTopicAction(action, caller, tid, title);
	}));
}

async function logTopicAction(action, req, tid, title) {
	var actionsToLog = ['delete', 'restore', 'purge'];
	if (!actionsToLog.includes(action)) {
		return;
	}
	await events.log({
		type: 'topic-' + action,
		uid: req.uid,
		ip: req.ip,
		tid: tid,
		title: String(title),
	});
}
