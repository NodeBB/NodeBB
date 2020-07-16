'use strict';

const async = require('async');
const user = require('../../user');
const topics = require('../../topics');
const categories = require('../../categories');
const privileges = require('../../privileges');
const socketHelpers = require('../helpers');

module.exports = function (SocketTopics) {
	SocketTopics.move = async function (socket, data) {
		if (!data || !Array.isArray(data.tids) || !data.cid) {
			throw new Error('[[error:invalid-data]]');
		}

		const canMove = await privileges.categories.isAdminOrMod(data.cid, socket.uid);
		if (!canMove) {
			throw new Error('[[error:no-privileges]]');
		}

		const uids = await user.getUidsFromSet('users:online', 0, -1);

		await async.eachLimit(data.tids, 10, async function (tid) {
			const canMove = await privileges.topics.isAdminOrMod(tid, socket.uid);
			if (!canMove) {
				throw new Error('[[error:no-privileges]]');
			}
			const topicData = await topics.getTopicFields(tid, ['tid', 'cid', 'slug', 'deleted']);
			data.uid = socket.uid;
			await topics.tools.move(tid, data);

			const notifyUids = await privileges.categories.filterUids('topics:read', topicData.cid, uids);
			socketHelpers.emitToTopicAndCategory('event:topic_moved', topicData, notifyUids);
			if (!topicData.deleted) {
				socketHelpers.sendNotificationToTopicOwner(tid, socket.uid, 'move', 'notifications:moved_your_topic');
			}
		});
	};


	SocketTopics.moveAll = async function (socket, data) {
		if (!data || !data.cid || !data.currentCid) {
			throw new Error('[[error:invalid-data]]');
		}
		const canMove = await privileges.categories.canMoveAllTopics(data.currentCid, data.cid, socket.uid);
		if (!canMove) {
			throw new Error('[[error:no-privileges]]');
		}

		const tids = await categories.getAllTopicIds(data.currentCid, 0, -1);
		data.uid = socket.uid;
		await async.eachLimit(tids, 50, async function (tid) {
			await topics.tools.move(tid, data);
		});
	};
};
