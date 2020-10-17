'use strict';

const privileges = require('../../privileges');
const posts = require('../../posts');
const topics = require('../../topics');
const events = require('../../events');

const api = require('../../api');
const helpers = require('../helpers');
const sockets = require('../../socket.io');
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
	const results = await isMainAndLastPost(req.params.pid);
	if (results.isMain && !results.isLast) {
		throw new Error('[[error:cant-purge-main-post]]');
	}

	const isMainAndLast = results.isMain && results.isLast;
	const postData = await posts.getPostFields(req.params.pid, ['pid', 'toPid', 'tid']);

	const canPurge = await privileges.posts.canPurge(req.params.pid, req.user.uid);
	if (!canPurge) {
		throw new Error('[[error:no-privileges]]');
	}
	require('../../posts/cache').del(req.params.pid);

	await posts.purge(req.params.pid, req.user.uid);
	helpers.formatApiResponse(200, res);

	sockets.in('topic_' + postData.tid).emit('event:post_purged', postData);
	const topicData = await topics.getTopicFields(postData.tid, ['title', 'cid']);

	await events.log({
		type: 'post-purge',
		uid: req.user.uid,
		pid: req.params.pid,
		ip: req.ip,
		tid: postData.tid,
		title: String(topicData.title),
	});

	if (isMainAndLast) {
		await apiHelpers.doTopicAction('purge', 'event:topic_purged', {
			ip: req.ip,
			uid: req.user.uid,
		}, { tids: [postData.tid], cid: topicData.cid });
	}
};

Posts.restore = async (req, res) => {
	await deleteOrRestore(req, {
		pid: req.params.pid,
	}, {
		command: 'restore',
		event: 'event:post_restored',
		type: 'post-restore',
	});

	helpers.formatApiResponse(200, res);
};

Posts.delete = async (req, res) => {
	await deleteOrRestore(req, {
		pid: req.params.pid,
	}, {
		command: 'delete',
		event: 'event:post_deleted',
		type: 'post-delete',
	});

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

async function isMainAndLastPost(pid) {
	const [isMain, topicData] = await Promise.all([
		posts.isMain(pid),
		posts.getTopicFields(pid, ['postcount']),
	]);
	return {
		isMain: isMain,
		isLast: topicData && topicData.postcount === 1,
	};
}

async function deleteOrRestoreTopicOf(command, pid, req) {
	const topic = await posts.getTopicFields(pid, ['tid', 'cid', 'deleted']);
	if (command === 'delete' && !topic.deleted) {
		await apiHelpers.doTopicAction('delete', 'event:topic_deleted', {
			uid: req.user.uid,
			ip: req.ip,
		}, { tids: [topic.tid], cid: topic.cid });
	} else if (command === 'restore' && topic.deleted) {
		await apiHelpers.doTopicAction('restore', 'event:topic_restored', {
			uid: req.user.uid,
			ip: req.ip,
		}, { tids: [topic.tid], cid: topic.cid });
	}
}

async function deleteOrRestore(req, data, params) {
	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	const postData = await posts.tools[params.command](req.user.uid, data.pid);
	const results = await isMainAndLastPost(data.pid);
	if (results.isMain && results.isLast) {
		await deleteOrRestoreTopicOf(params.command, data.pid, req);
	}

	sockets.in('topic_' + postData.tid).emit(params.event, postData);

	await events.log({
		type: params.type,
		uid: req.user.uid,
		pid: data.pid,
		tid: postData.tid,
		ip: req.ip,
	});
}
