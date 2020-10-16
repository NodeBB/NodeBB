'use strict';

const user = require('../user');
const topics = require('../topics');
const posts = require('../posts');
const meta = require('../meta');

const controllerHelpers = require('../controllers/helpers');
const socketHelpers = require('../socket.io/helpers');

const topicsAPI = module.exports;

topicsAPI.create = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const payload = { ...data };
	payload.tags = payload.tags || [];
	payload.uid = caller.uid;
	payload.uid = caller.uid;
	payload.req = controllerHelpers.buildReqObject(caller);
	payload.timestamp = Date.now();
	payload.fromQueue = false;

	// Blacklist & Post Queue
	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return queueObj;
	}

	const result = await topics.post(payload);

	socketHelpers.emitToUids('event:new_post', { posts: [result.postData] }, [caller.uid]);
	socketHelpers.emitToUids('event:new_topic', result.topicData, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });

	return result.topicData;
};

topicsAPI.reply = async function (caller, data) {
	var payload = {
		tid: data.tid,
		uid: caller.uid,
		req: controllerHelpers.buildReqObject(caller),	// For IP recording
		content: data.content,
		timestamp: data.timestamp,
		fromQueue: false,
	};

	if (data.toPid) { payload.toPid = data.toPid; }

	// Blacklist & Post Queue
	await meta.blacklist.test(caller.ip);
	const shouldQueue = await posts.shouldQueue(caller.uid, payload);
	if (shouldQueue) {
		const queueObj = await posts.addToQueue(payload);
		return queueObj;
	}

	const postData = await topics.reply(payload);	// postData seems to be a subset of postObj, refactor?
	const postObj = await posts.getPostSummaryByPids([postData.pid], caller.uid, {});

	const result = {
		posts: [postData],
		'reputation:disabled': meta.config['reputation:disabled'] === 1,
		'downvote:disabled': meta.config['downvote:disabled'] === 1,
	};

	user.updateOnlineUsers(caller.uid);
	socketHelpers.emitToUids('event:new_post', result, [caller.uid]);
	socketHelpers.notifyNew(caller.uid, 'newPost', result);

	return postObj[0];
};
