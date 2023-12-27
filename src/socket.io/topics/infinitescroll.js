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
			topics.getTopicData(data.tid),
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

		if (parseInt(data.direction, 10) === -1) {
			start -= infScrollPostsPerPage;
		}

		let stop = start + infScrollPostsPerPage - 1;

		start = Math.max(0, start);
		stop = Math.max(0, stop);
		const [posts, postSharing] = await Promise.all([
			topics.getTopicPosts(topicData, set, start, stop, socket.uid, reverse),
			social.getActivePostSharing(),
		]);

		topicData.posts = posts;
		topicData.privileges = userPrivileges;
		topicData.postSharing = postSharing;
		topicData['reputation:disabled'] = meta.config['reputation:disabled'] === 1;
		topicData['downvote:disabled'] = meta.config['downvote:disabled'] === 1;

		topics.modifyPostsByPrivilege(topicData, userPrivileges);
		return topicData;
	};
};
