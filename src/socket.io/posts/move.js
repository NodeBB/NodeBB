'use strict';

const privileges = require('../../privileges');
const topics = require('../../topics');
const posts = require('../../posts');
const socketHelpers = require('../helpers');

module.exports = function (SocketPosts) {
	SocketPosts.movePost = async function (socket, data) {
		await SocketPosts.movePosts(socket, { pids: [data.pid], tid: data.tid });
	};

	SocketPosts.movePosts = async function (socket, data) {
		if (!socket.uid) {
			throw new Error('[[error:not-logged-in]]');
		}

		if (!data || !Array.isArray(data.pids) || !data.tid) {
			throw new Error('[[error:invalid-data]]');
		}

		const canMove = await privileges.topics.isAdminOrMod(data.tid, socket.uid);
		if (!canMove) {
			throw new Error('[[error:no-privileges]]');
		}

		for (const pid of data.pids) {
			/* eslint-disable no-await-in-loop */
			const canMove = await privileges.posts.canMove(pid, socket.uid);
			if (!canMove) {
				throw new Error('[[error:no-privileges]]');
			}
			await topics.movePostToTopic(socket.uid, pid, data.tid);

			const [postDeleted, topicDeleted] = await Promise.all([
				posts.getPostField(pid, 'deleted'),
				topics.getTopicField(data.tid, 'deleted'),
			]);

			if (!postDeleted && !topicDeleted) {
				socketHelpers.sendNotificationToPostOwner(pid, socket.uid, 'move', 'notifications:moved_your_post');
			}
		}
	};
};
