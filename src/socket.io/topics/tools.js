'use strict';

const api = require('../../api');
const topics = require('../../topics');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const sockets = require('..');

module.exports = function (SocketTopics) {
	SocketTopics.loadTopicTools = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
		if (!data) {
			throw new Error('[[error:invalid-data]]');
		}

		const [topicData, userPrivileges] = await Promise.all([
			topics.getTopicData(data.tid),
			privileges.topics.get(data.tid, socket.uid),
		]);

		if (!topicData) {
			throw new Error('[[error:no-topic]]');
		}
		if (!userPrivileges['topics:read']) {
			throw new Error('[[error:no-privileges]]');
		}
		topicData.privileges = userPrivileges;
		const result = await plugins.fireHook('filter:topic.thread_tools', { topic: topicData, uid: socket.uid, tools: [] });
		result.topic.thread_tools = result.tools;
		return result.topic;
	};

	SocketTopics.delete = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/state');
		await api.topics.delete(socket, data);
	};

	SocketTopics.restore = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/state');
		await api.topics.restore(socket, data);
	};

	SocketTopics.purge = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics');
		await api.topics.purge(socket, data);
	};

	SocketTopics.lock = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/lock');
		await api.topics.lock(socket, data);
	};

	SocketTopics.unlock = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/lock');
		await api.topics.unlock(socket, data);
	};

	SocketTopics.pin = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/pin');
		await api.topics.pin(socket, data);
	};

	SocketTopics.unpin = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/pin');
		await api.topics.unpin(socket, data);
	};

	SocketTopics.orderPinnedTopics = async function (socket, data) {
		if (!Array.isArray(data)) {
			throw new Error('[[error:invalid-data]]');
		}

		await topics.tools.orderPinnedTopics(socket.uid, data);
	};
};
