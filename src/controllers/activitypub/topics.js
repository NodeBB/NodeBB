'use strict';

const user = require('../../user');
const topics = require('../../topics');

const { notes } = require('../../activitypub');
// const helpers = require('../helpers');
// const pagination = require('../../pagination');

const controller = module.exports;

controller.get = async function (req, res, next) {
	const tid = await notes.assertTopic(req.uid, req.query.resource);

	let postIndex = parseInt(req.params.post_index, 10) || 1;
	const [
		// userPrivileges,
		settings,
		// topicData,
	] = await Promise.all([
		// privileges.topics.get(tid, req.uid),
		user.getSettings(req.uid),
		// topics.getTopicData(tid),
	]);

	const topicData = {
		tid,
		postCount: 6,
		category: {}, // todo
	};

	let currentPage = parseInt(req.query.page, 10) || 1;
	const pageCount = Math.max(1, Math.ceil((topicData && topicData.postcount) / settings.postsPerPage));
	const invalidPagination = (settings.usePagination && (currentPage < 1 || currentPage > pageCount));
	if (
		!topicData ||
		// userPrivileges.disabled ||
		invalidPagination// ||
		// (topicData.scheduled && !userPrivileges.view_scheduled)
	) {
		return next();
	}

	if (!req.query.page) {
		currentPage = calculatePageFromIndex(postIndex, settings);
	}
	if (settings.usePagination && req.query.page) {
		const top = ((currentPage - 1) * settings.postsPerPage) + 1;
		const bottom = top + settings.postsPerPage;
		if (!req.params.post_index || (postIndex < top || postIndex > bottom)) {
			postIndex = top;
		}
	}
	const { start, stop } = calculateStartStop(currentPage, postIndex, settings);

	topicData.posts = await notes.getTopicPosts(tid, req.uid, start, stop);
	topicData.posts = await topics.addPostData(topicData.posts, req.uid);

	res.render('topic', topicData);
};

// todo: expose from topic controller?
function calculatePageFromIndex(postIndex, settings) {
	return 1 + Math.floor((postIndex - 1) / settings.postsPerPage);
}

// todo: expose from topic controller?
function calculateStartStop(page, postIndex, settings) {
	let startSkip = 0;

	if (!settings.usePagination) {
		if (postIndex > 1) {
			page = 1;
		}
		startSkip = Math.max(0, postIndex - Math.ceil(settings.postsPerPage / 2));
	}

	const start = ((page - 1) * settings.postsPerPage) + startSkip;
	const stop = start + settings.postsPerPage - 1;
	return { start: Math.max(0, start), stop: Math.max(0, stop) };
}