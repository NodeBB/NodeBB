'use strict';

const topics = require('../../topics');
const posts = require('../../posts');
const user = require('../../user');
const meta = require('../../meta');
const events = require('../../events');
const privileges = require('../../privileges');

const helpers = require('../helpers');
const socketHelpers = require('../../socket.io/helpers');

const Topics = module.exports;

Topics.create = async (req, res) => {
	const payload = { ...req.body };
	payload.tags = payload.tags || [];
	payload.uid = req.user.uid;
	payload.uid = req.user.uid;
	payload.req = req;
	payload.timestamp = Date.now();
	payload.fromQueue = false;

	// Blacklist & Post Queue
	await meta.blacklist.test(req.ip);
	const shouldQueue = await posts.shouldQueue(req.user.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return helpers.formatApiResponse(202, res, queueObj);
	}

	const result = await topics.post(payload);
	helpers.formatApiResponse(200, res, result.topicData);

	// TODO
	// socket.emit('event:new_post', { posts: [result.postData] });
	// socket.emit('event:new_topic', result.topicData);
	socketHelpers.notifyNew(req.user.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
};

Topics.reply = async (req, res) => {
	var payload = {
		tid: req.params.tid,
		uid: req.user.uid,
		req: helpers.buildReqObject(req),	// For IP recording
		content: req.body.content,
		timestamp: req.body.timestamp,
		fromQueue: false,
	};

	if (req.body.toPid) { payload.toPid = req.body.toPid; }

	// Blacklist & Post Queue
	await meta.blacklist.test(req.ip);
	const shouldQueue = await posts.shouldQueue(req.user.uid, payload);
	if (shouldQueue) {
		return await posts.addToQueue(payload);
	}

	const postData = await topics.reply(payload);	// postData seems to be a subset of postObj, refactor?
	const postObj = await posts.getPostSummaryByPids([postData.pid], req.user.uid, {});
	helpers.formatApiResponse(200, res, postObj[0]);

	const result = {
		posts: [postData],
		'reputation:disabled': meta.config['reputation:disabled'] === 1,
		'downvote:disabled': meta.config['downvote:disabled'] === 1,
	};

	// TODO
	// socket.emit('event:new_post', result);

	user.updateOnlineUsers(req.user.uid);
	socketHelpers.notifyNew(req.user.uid, 'newPost', result);
};

Topics.delete = async (req, res) => {
	await doTopicAction('delete', 'event:topic_deleted', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.restore = async (req, res) => {
	await doTopicAction('restore', 'event:topic_restored', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.purge = async (req, res) => {
	await doTopicAction('purge', 'event:topic_purged', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.pin = async (req, res) => {
	await doTopicAction('pin', 'event:topic_pinned', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.unpin = async (req, res) => {
	await doTopicAction('unpin', 'event:topic_unpinned', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.lock = async (req, res) => {
	await doTopicAction('lock', 'event:topic_locked', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.unlock = async (req, res) => {
	await doTopicAction('unlock', 'event:topic_unlocked', req, {
		tids: [req.params.tid],
	});
	helpers.formatApiResponse(200, res);
};

Topics.follow = async (req, res) => {
	await topics.follow(req.params.tid, req.user.uid);
	helpers.formatApiResponse(200, res);
};

Topics.ignore = async (req, res) => {
	await topics.ignore(req.params.tid, req.user.uid);
	helpers.formatApiResponse(200, res);
};

Topics.unfollow = async (req, res) => {
	await topics.unfollow(req.params.tid, req.user.uid);
	helpers.formatApiResponse(200, res);
};

async function doTopicAction(action, event, socket, { tids }) {
	if (!Array.isArray(tids)) {
		throw new Error('[[error:invalid-tid]]');
	}

	if (typeof topics.tools[action] !== 'function') {
		return;
	}

	const uids = await user.getUidsFromSet('users:online', 0, -1);

	await Promise.all(tids.map(async function (tid) {
		const title = await topics.getTopicField(tid, 'title');
		const data = await topics.tools[action](tid, socket.uid);
		const notifyUids = await privileges.categories.filterUids('topics:read', data.cid, uids);
		socketHelpers.emitToTopicAndCategory(event, data, notifyUids);
		await logTopicAction(action, socket, tid, title);
	}));
}

async function logTopicAction(action, req, tid, title) {
	var actionsToLog = ['delete', 'restore', 'purge'];
	if (!actionsToLog.includes(action)) {
		return;
	}
	await events.log({
		type: 'topic-' + action,
		uid: req.uid,
		ip: req.ip,
		tid: tid,
		title: String(title),
	});
}
