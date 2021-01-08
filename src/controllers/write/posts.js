'use strict';

const posts = require('../../posts');

const api = require('../../api');
const helpers = require('../helpers');
const apiHelpers = require('../../api/helpers');

const Posts = module.exports;

Posts.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.posts.get(req, { pid: req.params.pid }));
};

Posts.edit = async (req, res) => {
	const editResult = await api.posts.edit(req, {
		...req.body,
		pid: req.params.pid,
		uid: req.uid,
		req: apiHelpers.buildReqObject(req),
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
