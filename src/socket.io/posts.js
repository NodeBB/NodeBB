'use strict';

const validator = require('validator');

const db = require('../database');
const posts = require('../posts');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const topics = require('../topics');
const notifications = require('../notifications');
const utils = require('../utils');
const events = require('../events');
const translator = require('../translator');

const api = require('../api');
const sockets = require('.');

const SocketPosts = module.exports;

require('./posts/votes')(SocketPosts);
require('./posts/tools')(SocketPosts);

SocketPosts.getRawPost = async function (socket, pid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/raw');

	return await api.posts.getRaw(socket, { pid });
};

SocketPosts.getPostSummaryByIndex = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/byIndex/:index/summary?tid=:tid');

	if (data.index < 0) {
		data.index = 0;
	}
	let pid;
	if (data.index === 0) {
		pid = await topics.getTopicField(data.tid, 'mainPid');
	} else {
		pid = await db.getSortedSetRange(`tid:${data.tid}:posts`, data.index - 1, data.index - 1);
	}
	pid = Array.isArray(pid) ? pid[0] : pid;
	if (!pid) {
		return 0;
	}

	return await api.posts.getSummary(socket, { pid });
};

SocketPosts.getPostTimestampByIndex = async function (socket, data) {
	if (data.index < 0) {
		data.index = 0;
	}
	let pid;
	if (data.index === 0) {
		pid = await topics.getTopicField(data.tid, 'mainPid');
	} else {
		pid = await db.getSortedSetRange(`tid:${data.tid}:posts`, data.index - 1, data.index - 1);
	}
	pid = Array.isArray(pid) ? pid[0] : pid;
	const topicPrivileges = await privileges.topics.get(data.tid, socket.uid);
	if (!topicPrivileges['topics:read']) {
		throw new Error('[[error:no-privileges]]');
	}

	return await posts.getPostField(pid, 'timestamp');
};

SocketPosts.getPostSummaryByPid = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/summary');

	const { pid } = data;
	return await api.posts.getSummary(socket, { pid });
};

SocketPosts.getCategory = async function (socket, pid) {
	return await posts.getCidByPid(pid);
};

SocketPosts.getPidIndex = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/index');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	return await api.posts.getIndex(socket, {
		pid: data.pid,
		sort: data.topicPostSort,
	});
};

SocketPosts.getReplies = async function (socket, pid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/replies');

	if (!utils.isNumber(pid)) {
		throw new Error('[[error:invalid-data]]');
	}

	return await api.posts.getReplies(socket, { pid });
};

SocketPosts.accept = async function (socket, data) {
	await canEditQueue(socket, data, 'accept');
	const result = await posts.submitFromQueue(data.id);
	if (result && socket.uid !== parseInt(result.uid, 10)) {
		await sendQueueNotification('post-queue-accepted', result.uid, `/post/${result.pid}`);
	}
	await logQueueEvent(socket, result, 'accept');
};

SocketPosts.reject = async function (socket, data) {
	await canEditQueue(socket, data, 'reject');
	const result = await posts.removeFromQueue(data.id);
	if (result && socket.uid !== parseInt(result.uid, 10)) {
		await sendQueueNotification('post-queue-rejected', result.uid, '/');
	}
	await logQueueEvent(socket, result, 'reject');
};

async function logQueueEvent(socket, result, type) {
	const eventData = {
		type: `post-queue-${result.type}-${type}`,
		uid: socket.uid,
		ip: socket.ip,
		content: result.data.content,
		targetUid: result.uid,
	};
	if (result.type === 'topic') {
		eventData.cid = result.data.cid;
		eventData.title = result.data.title;
	} else {
		eventData.tid = result.data.tid;
	}
	if (result.pid) {
		eventData.pid = result.pid;
	}
	await events.log(eventData);
}

SocketPosts.notify = async function (socket, data) {
	await canEditQueue(socket, data, 'notify');
	const result = await posts.getFromQueue(data.id);
	if (result) {
		await sendQueueNotification('post-queue-notify', result.uid, `/post-queue/${data.id}`, validator.escape(String(data.message)));
	}
};

async function canEditQueue(socket, data, action) {
	const [canEditQueue, queuedPost] = await Promise.all([
		posts.canEditQueue(socket.uid, data, action),
		posts.getFromQueue(data.id),
	]);
	if (!queuedPost) {
		throw new Error('[[error:no-post]]');
	}
	if (!canEditQueue) {
		throw new Error('[[error:no-privileges]]');
	}
}

async function sendQueueNotification(type, targetUid, path, notificationText) {
	const bodyShort = notificationText ?
		translator.compile(`notifications:${type}`, notificationText) :
		translator.compile(`notifications:${type}`);
	const notifData = {
		type: type,
		nid: `${type}-${targetUid}-${path}`,
		bodyShort: bodyShort,
		path: path,
	};
	if (parseInt(meta.config.postQueueNotificationUid, 10) > 0) {
		notifData.from = meta.config.postQueueNotificationUid;
	}
	const notifObj = await notifications.create(notifData);
	await notifications.push(notifObj, [targetUid]);
}

SocketPosts.editQueuedContent = async function (socket, data) {
	if (!data || !data.id || (!data.content && !data.title && !data.cid)) {
		throw new Error('[[error:invalid-data]]');
	}
	await posts.editQueuedContent(socket.uid, data);
	if (data.content) {
		return await plugins.hooks.fire('filter:parse.post', { postData: data });
	}
	return { postData: data };
};

require('../promisify')(SocketPosts);
