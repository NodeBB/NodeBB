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

async function getPidByIndex(tid, index, sort) {
	if (index === 0) {
		return await topics.getTopicField(tid, 'mainPid');
	}
	const set = sort === 'most_votes' ? `tid:${tid}:posts:votes` : `tid:${tid}:posts`;
	const reverse = sort === 'newest_to_oldest' || sort === 'most_votes';
	const pids = await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, index - 1, index - 1);
	return pids.length ? pids[0] : null;
}

SocketPosts.getPostSummaryByIndex = async function (socket, data) {
	if (data.index < 0) {
		data.index = 0;
	}
	const pid = await getPidByIndex(data.tid, data.index, data.sort);
	if (!pid) {
		return 0;
	}

	return await api.posts.getSummary(socket, { pid });
};

SocketPosts.getPostTimestampByIndex = async function (socket, data) {
	if (data.index < 0) {
		data.index = 0;
	}
	const pid = await getPidByIndex(data.tid, data.index, data.sort);
	const [postPrivileges] = await privileges.posts.get([pid], socket.uid);
	if (!postPrivileges.read || !postPrivileges['topics:read'] || postPrivileges.disabled) {
		throw new Error('[[error:no-privileges]]');
	}

	return await posts.getPostField(pid, 'timestamp');
};

SocketPosts.getPostSummaryByPid = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/posts/:pid/summary');

	const { pid } = data;
	return await api.posts.getSummary(socket, { pid });
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
