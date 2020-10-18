'use strict';

const posts = require('../../posts');

const api = require('../../api');
const helpers = require('../helpers');
const apiHelpers = require('../../api/helpers');
const socketPostHelpers = require('../../socket.io/posts/helpers');	// eehhh...

const Posts = module.exports;

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
	const data = { pid: req.params.pid, room_id: `topic_${tid}` };
	const socketMock = { uid: req.user.uid };

	return { data, socketMock };
}

Posts.vote = async (req, res) => {
	const { data, socketMock } = await mock(req);

	if (req.body.delta > 0) {
		await socketPostHelpers.postCommand(socketMock, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data);
	} else if (req.body.delta < 0) {
		await socketPostHelpers.postCommand(socketMock, 'downvote', 'voted', '', data);
	} else {
		await socketPostHelpers.postCommand(socketMock, 'unvote', 'voted', '', data);
	}

	helpers.formatApiResponse(200, res);
};

Posts.unvote = async (req, res) => {
	const { data, socketMock } = await mock(req);

	await socketPostHelpers.postCommand(socketMock, 'unvote', 'voted', '', data);
	helpers.formatApiResponse(200, res);
};

Posts.bookmark = async (req, res) => {
	const { data, socketMock } = await mock(req);

	await socketPostHelpers.postCommand(socketMock, 'bookmark', 'bookmarked', '', data);
	helpers.formatApiResponse(200, res);
};

Posts.unbookmark = async (req, res) => {
	const { data, socketMock } = await mock(req);

	await socketPostHelpers.postCommand(socketMock, 'unbookmark', 'bookmarked', '', data);
	helpers.formatApiResponse(200, res);
};
