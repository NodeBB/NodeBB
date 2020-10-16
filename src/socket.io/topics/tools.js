'use strict';

const user = require('../../user');
const topics = require('../../topics');
const events = require('../../events');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const socketHelpers = require('../helpers');
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
		await SocketTopics.doTopicAction('delete', 'event:topic_deleted', socket, data);
	};

	SocketTopics.restore = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/state');
		await SocketTopics.doTopicAction('restore', 'event:topic_restored', socket, data);
	};

	SocketTopics.purge = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics');
		await SocketTopics.doTopicAction('purge', 'event:topic_purged', socket, data);
	};

	SocketTopics.lock = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/lock');
		await SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, data);
	};

	SocketTopics.unlock = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/lock');
		await SocketTopics.doTopicAction('unlock', 'event:topic_unlocked', socket, data);
	};

	SocketTopics.pin = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/pin');
		await SocketTopics.doTopicAction('pin', 'event:topic_pinned', socket, data);
	};

	SocketTopics.unpin = async function (socket, data) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/pin');
		await SocketTopics.doTopicAction('unpin', 'event:topic_unpinned', socket, data);
	};

	SocketTopics.doTopicAction = async function (action, event, socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}

		if (!data || !Array.isArray(data.tids)) {
			throw new Error('[[error:invalid-tid]]');
		}

		if (typeof topics.tools[action] !== 'function') {
			return;
		}

		const uids = await user.getUidsFromSet('users:online', 0, -1);

		await Promise.all(data.tids.map(async function (tid) {
			const title = await topics.getTopicField(tid, 'title');
			const data = await topics.tools[action](tid, socket.uid);
			const notifyUids = await privileges.categories.filterUids('topics:read', data.cid, uids);
			socketHelpers.emitToUids(event, data, notifyUids);
			await logTopicAction(action, socket, tid, title);
		}));
	};

	async function logTopicAction(action, socket, tid, title) {
		var actionsToLog = ['delete', 'restore', 'purge'];
		if (!actionsToLog.includes(action)) {
			return;
		}
		await events.log({
			type: 'topic-' + action,
			uid: socket.uid,
			ip: socket.ip,
			tid: tid,
			title: String(title),
		});
	}

	SocketTopics.orderPinnedTopics = async function (socket, data) {
		if (!Array.isArray(data)) {
			throw new Error('[[error:invalid-data]]');
		}

		await topics.tools.orderPinnedTopics(socket.uid, data);
	};
};
