'use strict';

const nconf = require('nconf');

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');
const privileges = require('../../privileges');

const { notes } = require('../../activitypub');
// const helpers = require('../helpers');
const pagination = require('../../pagination');
const helpers = require('../helpers');

const controller = module.exports;

controller.list = async function (req, res, next) {
	const { topicsPerPage } = await user.getSettings(req.uid);
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;

	const tids = await db.getSortedSetRevRange('cid:-1:tids', start, stop);
	const topicData = await topics.getTopicsByTids(tids, { uid: req.uid });
	topics.calculateTopicIndices(topicData, start);
	res.render('world', {
		topics: topicData,
	});
};

controller.get = async function (req, res, next) {
	/**
	 * Ideally we would use the existing topicsController.get...
	 * this controller may be a stopgap towards that end goal.
	 */
	const pid = await notes.resolveId(req.uid, req.query.resource);
	if (pid !== req.query.resource) {
		return helpers.redirect(res, `/topic/remote?resource=${pid}`, true);
	}

	const tid = await notes.assertTopic(req.uid, req.query.resource);

	let postIndex = Math.max(1, await db.sortedSetRank(`tidRemote:${tid}:posts`, req.query.resource));
	const [
		userPrivileges,
		settings,
		// topicData,
	] = await Promise.all([
		privileges.topics.get(tid, req.uid),
		user.getSettings(req.uid),
		// topics.getTopicData(tid),
	]);

	const topicData = await topics.getTopicData(tid);
	topicData.category = {}; // todo

	let currentPage = parseInt(req.query.page, 10) || 1;
	const pageCount = Math.max(1, Math.ceil((topicData && topicData.postcount) / settings.postsPerPage));
	const invalidPagination = (settings.usePagination && (currentPage < 1 || currentPage > pageCount));
	if (
		!topicData ||
		userPrivileges.disabled ||
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
	await topics.calculatePostIndices(topicData.posts, start - 1);
	topicData.posts = await topics.addPostData(topicData.posts, req.uid);
	topicData.privileges = userPrivileges;

	await topics.increaseViewCount(req, tid);

	topicData.postIndex = postIndex;
	topicData.pagination = pagination.create(currentPage, pageCount, req.query);
	topicData.pagination.rel.forEach((rel) => {
		rel.href = `${nconf.get('url')}/topic/${topicData.slug}${rel.href}`;
		res.locals.linkTags.push(rel);
	});

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
