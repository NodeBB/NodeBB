'use strict';

const posts = require('../../posts');
const user = require('../../user');
const privileges = require('../../privileges');
const apiHelpers = require('../../api/helpers');
const websockets = require('..');

module.exports = function (SocketPosts) {
	SocketPosts.getDiffs = async function (socket, data) {
		await privilegeCheck(data.pid, socket.uid);
		const timestamps = await posts.diffs.list(data.pid);
		const post = await posts.getPostFields(data.pid, ['timestamp', 'uid']);

		const diffs = await posts.diffs.get(data.pid);
		const uids = diffs.map(diff => diff.uid || null);
		uids.push(post.uid);
		let usernames = await user.getUsersFields(uids, ['username']);
		usernames = usernames.map(userObj => (userObj.uid ? userObj.username : null));

		const cid = await posts.getCidByPid(data.pid);
		const canEdit = await privileges.categories.can('edit', cid, socket.uid);
		timestamps.push(post.timestamp);

		return {
			timestamps: timestamps,
			revisions: timestamps.map((timestamp, idx) => ({
				timestamp: timestamp,
				username: usernames[idx],
			})),
			editable: canEdit,
		};
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

	SocketPosts.restoreDiff = async function (socket, data) {
		const cid = await posts.getCidByPid(data.pid);
		const canEdit = await privileges.categories.can('edit', cid, socket.uid);
		if (!canEdit) {
			throw new Error('[[error:no-privileges]]');
		}

		const edit = await posts.diffs.restore(data.pid, data.since, socket.uid, apiHelpers.buildReqObject(socket));
		websockets.in('topic_' + edit.topic.tid).emit('event:post_edited', edit);
	};
};
