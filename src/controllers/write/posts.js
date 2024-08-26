'use strict';

const nconf = require('nconf');

const db = require('../../database');
const topics = require('../../topics');
const posts = require('../../posts');
const api = require('../../api');
const helpers = require('../helpers');

const Posts = module.exports;

Posts.redirectByIndex = async (req, res, next) => {
	const { tid } = req.query || req.body;

	let { index } = req.params;
	if (index < 0 || !isFinite(index)) {
		index = 0;
	}
	index = parseInt(index, 10);

	let pid;
	if (index === 0) {
		pid = await topics.getTopicField(tid, 'mainPid');
	} else {
		pid = await db.getSortedSetRange(`tid:${tid}:posts`, index - 1, index - 1);
	}
	pid = Array.isArray(pid) ? pid[0] : pid;
	if (!pid) {
		return next('route');
	}

	const path = req.path.split('/').slice(3).join('/');
	const urlObj = new URL(nconf.get('url') + req.url);
	res.redirect(308, nconf.get('relative_path') + encodeURI(`/api/v3/posts/${pid}/${path}${urlObj.search}`));
};

Posts.get = async (req, res) => {
	const post = await api.posts.get(req, { pid: req.params.pid });
	if (!post) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	helpers.formatApiResponse(200, res, post);
};

Posts.getIndex = async (req, res) => {
	const { pid } = req.params;
	const { sort } = req.body;

	const index = await api.posts.getIndex(req, { pid, sort });
	if (index === null) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	helpers.formatApiResponse(200, res, { index });
};

Posts.getSummary = async (req, res) => {
	const post = await api.posts.getSummary(req, { pid: req.params.pid });
	if (!post) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	helpers.formatApiResponse(200, res, post);
};

Posts.getRaw = async (req, res) => {
	const content = await api.posts.getRaw(req, { pid: req.params.pid });
	if (content === null) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	helpers.formatApiResponse(200, res, { content });
};

Posts.edit = async (req, res) => {
	const editResult = await api.posts.edit(req, {
		...req.body,
		pid: req.params.pid,
		uid: req.uid,
	});

	helpers.formatApiResponse(200, res, editResult);
};

Posts.purge = async (req, res) => {
	await api.posts.purge(req, { pid: req.params.pid });
	helpers.formatApiResponse(200, res);
};

Posts.restore = async (req, res) => {
	await api.posts.restore(req, { pid: req.params.pid });
	helpers.formatApiResponse(200, res);
};

Posts.delete = async (req, res) => {
	await api.posts.delete(req, { pid: req.params.pid });
	helpers.formatApiResponse(200, res);
};

Posts.move = async (req, res) => {
	await api.posts.move(req, {
		pid: req.params.pid,
		tid: req.body.tid,
	});
	helpers.formatApiResponse(200, res);
};

async function mock(req) {
	const tid = await posts.getPostField(req.params.pid, 'tid');
	return { pid: req.params.pid, room_id: `topic_${tid}` };
}

Posts.vote = async (req, res) => {
	const data = await mock(req);
	if (req.body.delta > 0) {
		await api.posts.upvote(req, data);
	} else if (req.body.delta < 0) {
		await api.posts.downvote(req, data);
	} else {
		await api.posts.unvote(req, data);
	}

	helpers.formatApiResponse(200, res);
};

Posts.unvote = async (req, res) => {
	const data = await mock(req);
	await api.posts.unvote(req, data);
	helpers.formatApiResponse(200, res);
};

Posts.getVoters = async (req, res) => {
	const data = await api.posts.getVoters(req, { pid: req.params.pid });
	helpers.formatApiResponse(200, res, data);
};

Posts.getUpvoters = async (req, res) => {
	const data = await api.posts.getUpvoters(req, { pid: req.params.pid });
	helpers.formatApiResponse(200, res, data);
};

Posts.bookmark = async (req, res) => {
	const data = await mock(req);
	await api.posts.bookmark(req, data);
	helpers.formatApiResponse(200, res);
};

Posts.unbookmark = async (req, res) => {
	const data = await mock(req);
	await api.posts.unbookmark(req, data);
	helpers.formatApiResponse(200, res);
};

Posts.getDiffs = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.posts.getDiffs(req, { ...req.params }));
};

Posts.loadDiff = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.posts.loadDiff(req, { ...req.params }));
};

Posts.restoreDiff = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.posts.restoreDiff(req, { ...req.params }));
};

Posts.deleteDiff = async (req, res) => {
	await api.posts.deleteDiff(req, { ...req.params });

	helpers.formatApiResponse(200, res, await api.posts.getDiffs(req, { ...req.params }));
};

Posts.getReplies = async (req, res) => {
	const replies = await api.posts.getReplies(req, { ...req.params });
	if (replies === null) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	helpers.formatApiResponse(200, res, { replies });
};
