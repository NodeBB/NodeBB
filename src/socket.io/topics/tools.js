'use strict';

const topics = require('../../topics');
const privileges = require('../../privileges');
const plugins = require('../../plugins');

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
		const result = await plugins.hooks.fire('filter:topic.thread_tools', { topic: topicData, uid: socket.uid, tools: [] });
		result.topic.thread_tools = result.tools;
		return result.topic;
	};

	SocketTopics.orderPinnedTopics = async function (socket, data) {
		if (!data || !data.tid) {
			throw new Error('[[error:invalid-data]]');
		}

		await topics.tools.orderPinnedTopics(socket.uid, data);
	};
};
