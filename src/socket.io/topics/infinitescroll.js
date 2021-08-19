'use strict';

const topics = require('../../topics');
const privileges = require('../../privileges');
const meta = require('../../meta');
const utils = require('../../utils');
const social = require('../../social');

module.exports = function (SocketTopics) {
	SocketTopics.loadMore = async function (socket, data) {
		if (!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
			throw new Error('[[error:invalid-data]]');
		}

		const [userPrivileges, topicData] = await Promise.all([
			privileges.topics.get(data.tid, socket.uid),
			topics.getTopicFields(data.tid, ['postcount', 'deleted', 'scheduled', 'uid']),
		]);

		if (!userPrivileges['topics:read'] || !privileges.topics.canViewDeletedScheduled(topicData, userPrivileges)) {
			throw new Error('[[error:no-privileges]]');
		}

		const set = data.topicPostSort === 'most_votes' ? `tid:${data.tid}:posts:votes` : `tid:${data.tid}:posts`;
		const reverse = data.topicPostSort === 'newest_to_oldest' || data.topicPostSort === 'most_votes';
		let start = Math.max(0, parseInt(data.after, 10));

		const infScrollPostsPerPage = Math.max(0, Math.min(
			meta.config.postsPerPage || 20,
			parseInt(data.count, 10) || meta.config.postsPerPage || 20
		));

		if (data.direction === -1) {
			start -= (infScrollPostsPerPage + 1);
		}

		let stop = start + infScrollPostsPerPage - 1;

		start = Math.max(0, start);
		stop = Math.max(0, stop);

		const [mainPost, posts, postSharing] = await Promise.all([
			start > 0 ? null : topics.getMainPost(data.tid, socket.uid),
			topics.getTopicPosts(data.tid, set, start, stop, socket.uid, reverse),
			social.getActivePostSharing(),
		]);

		if (mainPost) {
			topicData.mainPost = mainPost;
			topicData.posts = [mainPost].concat(posts);
		} else {
			topicData.posts = posts;
		}

		topicData.privileges = userPrivileges;
		topicData.postSharing = postSharing;
		topicData['reputation:disabled'] = meta.config['reputation:disabled'] === 1;
		topicData['downvote:disabled'] = meta.config['downvote:disabled'] === 1;

		topics.modifyPostsByPrivilege(topicData, userPrivileges);
		return topicData;
	};

	SocketTopics.loadMoreSortedTopics = async function (socket, data) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
			throw new Error('[[error:invalid-data]]');
		}
		const { start, stop } = calculateStartStop(data);
		const params = {
			uid: socket.uid,
			start: start,
			stop: stop,
			filter: data.filter,
			query: data.query,
		};
		if (data.sort === 'unread') {
			params.cid = data.cid;
			return await topics.getUnreadTopics(params);
		}
		params.cids = data.cid;
		params.tags = data.tags;
		params.sort = data.sort;
		params.term = data.term;
		return await topics.getSortedTopics(params);
	};

	SocketTopics.loadMoreFromSet = async function (socket, data) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0 || !data.set) {
			throw new Error('[[error:invalid-data]]');
		}
		const { start, stop } = calculateStartStop(data);
		return await topics.getTopicsFromSet(data.set, socket.uid, start, stop);
	};

	function calculateStartStop(data) {
		const itemsPerPage = Math.min(
			meta.config.topicsPerPage || 20,
			parseInt(data.count, 10) || meta.config.topicsPerPage || 20
		);
		let start = Math.max(0, parseInt(data.after, 10));
		if (data.direction === -1) {
			start -= itemsPerPage;
		}
		const stop = start + Math.max(0, itemsPerPage - 1);
		return { start: Math.max(0, start), stop: Math.max(0, stop) };
	}
};
