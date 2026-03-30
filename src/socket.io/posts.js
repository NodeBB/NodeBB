'use strict';

const db = require('../database');
const posts = require('../posts');
const privileges = require('../privileges');
const topics = require('../topics');
const utils = require('../utils');
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
	sockets.warnDeprecated(socket, 'POST /api/v3/posts/queue/:id');
	await api.posts.acceptQueuedPost(socket, data);
};

SocketPosts.reject = async function (socket, data) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/posts/queue/:id');
	await api.posts.removeQueuedPost(socket, data);
};

SocketPosts.notify = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/posts/queue/:id/notify');
	await api.posts.notifyQueuedPostOwner(socket, data);
};

SocketPosts.editQueuedContent = async function (socket, data) {
	sockets.warnDeprecated(socket, 'PUT /api/v3/posts/queue/:id');
	return await api.posts.editQueuedPost(socket, data);
};

require('../promisify')(SocketPosts);
