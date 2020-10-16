'use strict';

const api = require('../api');
const topics = require('../topics');
const user = require('../user');
const meta = require('../meta');
const apiController = require('../controllers/api');
const privileges = require('../privileges');
const sockets = require('.');

const SocketTopics = module.exports;

require('./topics/unread')(SocketTopics);
require('./topics/move')(SocketTopics);
require('./topics/tools')(SocketTopics);
require('./topics/infinitescroll')(SocketTopics);
require('./topics/tags')(SocketTopics);
require('./topics/merge')(SocketTopics);

SocketTopics.post = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/topics');
	return await api.topics.create(socket, data);
};

SocketTopics.postcount = async function (socket, tid) {
	const canRead = await privileges.topics.can('topics:read', tid, socket.uid);
	if (!canRead) {
		throw new Error('[[no-privileges]]');
	}
	return await topics.getTopicField(tid, 'postcount');
};

SocketTopics.bookmark = async function (socket, data) {
	if (!socket.uid || !data) {
		throw new Error('[[error:invalid-data]]');
	}
	const postcount = await topics.getTopicField(data.tid, 'postcount');
	if (data.index > meta.config.bookmarkThreshold && postcount > meta.config.bookmarkThreshold) {
		await topics.setUserBookmark(data.tid, socket.uid, data.index);
	}
};

SocketTopics.createTopicFromPosts = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	if (!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		throw new Error('[[error:invalid-data]]');
	}

	return await topics.createTopicFromPosts(socket.uid, data.title, data.pids, data.fromTid);
};

SocketTopics.changeWatching = async function (socket, data) {
	if (!data || !data.tid || !data.type) {
		throw new Error('[[error:invalid-data]]');
	}
	const commands = ['follow', 'unfollow', 'ignore'];
	if (!commands.includes(data.type)) {
		throw new Error('[[error:invalid-command]]');
	}

	sockets.warnDeprecated(socket, 'PUT/DELETE /api/v3/topics/:tid/(follow|ignore)');
	await followCommand(topics[data.type], socket, data.tid);
};

SocketTopics.follow = async function (socket, tid) {
	sockets.warnDeprecated(socket, 'PUT /api/v3/topics/:tid/follow');
	await followCommand(topics.follow, socket, tid);
};

async function followCommand(method, socket, tid) {
	if (!socket.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	await method(tid, socket.uid);
}

SocketTopics.isFollowed = async function (socket, tid) {
	const isFollowing = await topics.isFollowing([tid], socket.uid);
	return isFollowing[0];
};

SocketTopics.search = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	return await topics.search(data.tid, data.term);
};

SocketTopics.isModerator = async function (socket, tid) {
	const cid = await topics.getTopicField(tid, 'cid');
	return await user.isModerator(socket.uid, cid);
};

SocketTopics.getTopic = async function (socket, tid) {
	return await apiController.getTopicData(tid, socket.uid);
};

require('../promisify')(SocketTopics);
