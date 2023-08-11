'use strict';

const _ = require('lodash');

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');
const user = require('../user');
const meta = require('../meta');
const privileges = require('../privileges');
const cache = require('../cache');
const events = require('../events');

const SocketTopics = module.exports;

require('./topics/unread')(SocketTopics);
require('./topics/move')(SocketTopics);
require('./topics/tools')(SocketTopics);
require('./topics/infinitescroll')(SocketTopics);
require('./topics/tags')(SocketTopics);
require('./topics/merge')(SocketTopics);

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
		const currentIndex = await db.sortedSetScore(`tid:${data.tid}:bookmarks`, socket.uid);
		if (!currentIndex || (data.index > currentIndex && data.index <= postcount) || (currentIndex > postcount)) {
			await topics.setUserBookmark(data.tid, socket.uid, data.index);
		}
	}
};

SocketTopics.createTopicFromPosts = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	if (!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		throw new Error('[[error:invalid-data]]');
	}

	const result = await topics.createTopicFromPosts(socket.uid, data.title, data.pids, data.fromTid, data.cid);
	await events.log({
		type: `topic-fork`,
		uid: socket.uid,
		ip: socket.ip,
		pids: String(data.pids),
		fromTid: data.fromTid,
		toTid: result.tid,
	});
	return result;
};

SocketTopics.isFollowed = async function (socket, tid) {
	const isFollowing = await topics.isFollowing([tid], socket.uid);
	return isFollowing[0];
};

SocketTopics.isModerator = async function (socket, tid) {
	const cid = await topics.getTopicField(tid, 'cid');
	return await user.isModerator(socket.uid, cid);
};

SocketTopics.getMyNextPostIndex = async function (socket, data) {
	if (!data || !data.tid || !data.index || !data.sort) {
		throw new Error('[[error:invalid-data]]');
	}

	async function getTopicPids(index) {
		const topicSet = data.sort === 'most_votes' ? `tid:${data.tid}:posts:votes` : `tid:${data.tid}:posts`;
		const reverse = data.sort === 'newest_to_oldest' || data.sort === 'most_votes';
		const cacheKey = `np:s:${topicSet}:r:${String(reverse)}:tid:${data.tid}:pids`;
		const topicPids = cache.get(cacheKey);
		if (topicPids) {
			return topicPids.slice(index - 1);
		}
		const pids = await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](topicSet, 0, -1);
		cache.set(cacheKey, pids, 30000);
		return pids.slice(index - 1);
	}

	async function getUserPids() {
		const cid = await topics.getTopicField(data.tid, 'cid');
		const cacheKey = `np:cid:${cid}:uid:${socket.uid}:pids`;
		const userPids = cache.get(cacheKey);
		if (userPids) {
			return userPids;
		}
		const pids = await db.getSortedSetRange(`cid:${cid}:uid:${socket.uid}:pids`, 0, -1);
		cache.set(cacheKey, pids, 30000);
		return pids;
	}
	const postCountInTopic = await db.sortedSetScore(`tid:${data.tid}:posters`, socket.uid);
	if (postCountInTopic <= 0) {
		return 0;
	}
	const [topicPids, userPidsInCategory] = await Promise.all([
		getTopicPids(data.index),
		getUserPids(),
	]);
	const userPidsInTopic = _.intersection(topicPids, userPidsInCategory);
	if (!userPidsInTopic.length) {
		if (postCountInTopic > 0) {
			// wrap around to beginning
			const wrapIndex = await SocketTopics.getMyNextPostIndex(socket, { ...data, index: 1 });
			return wrapIndex;
		}
		return 0;
	}
	return await posts.getPidIndex(userPidsInTopic[0], data.tid, data.sort);
};

SocketTopics.getPostCountInTopic = async function (socket, tid) {
	if (!socket.uid || !tid) {
		return 0;
	}
	return await db.sortedSetScore(`tid:${tid}:posters`, socket.uid);
};

require('../promisify')(SocketTopics);
