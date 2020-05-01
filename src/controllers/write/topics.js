'use strict';

const topics = require('../../topics');
const posts = require('../../posts');
const user = require('../../user');
const meta = require('../../meta');

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
