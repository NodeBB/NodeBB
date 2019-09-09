'use strict';

const posts = require('../../posts');
const privileges = require('../../privileges');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = async function (socket, data) {
		await privilegeCheck(data.pid, socket.uid);
		const timestamps = await posts.diffs.list(data.pid);
		timestamps.unshift(Date.now());
		return timestamps;
	};

	SocketPosts.showPostAt = async function (socket, data) {
		await privilegeCheck(data.pid, socket.uid);
		return await posts.diffs.load(data.pid, data.since, socket.uid);
	};

	async function privilegeCheck(pid, uid) {
		const [deleted, privilegesData] = await Promise.all([
			posts.getPostField(pid, 'deleted'),
			privileges.posts.get([pid], uid),
		]);

		const allowed = privilegesData[0]['posts:history'] && (deleted ? privilegesData[0]['posts:view_deleted'] : true);
		if (!allowed) {
			throw new Error('[[error:no-privileges]]');
		}
	}
};
