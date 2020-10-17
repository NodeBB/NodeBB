'use strict';

const url = require('url');
const user = require('../user');
const topics = require('../topics');
const privileges = require('../privileges');
const socketHelpers = require('../socket.io/helpers');
const events = require('../events');

// creates a slimmed down version of the request object
exports.buildReqObject = (req, payload) => {
	req = req || {};
	const headers = req.headers || {};
	const encrypted = req.connection ? !!req.connection.encrypted : false;
	let host = headers.host;
	const referer = headers.referer || '';

	if (!host) {
		host = url.parse(referer).host || '';
	}

	return {
		uid: req.uid,
		params: req.params,
		method: req.method,
		body: payload || req.body,
		ip: req.ip,
		host: host,
		protocol: encrypted ? 'https' : 'http',
		secure: encrypted,
		url: referer,
		path: referer.substr(referer.indexOf(host) + host.length),
		headers: headers,
	};
};


exports.doTopicAction = async function (action, event, caller, { tids }) {
	if (!Array.isArray(tids)) {
		throw new Error('[[error:invalid-tid]]');
	}

	const exists = (await Promise.all(tids.map(async tid => await topics.exists(tid)))).every(Boolean);
	if (!exists) {
		throw new Error('[[error:no-topic]]');
	}

	if (typeof topics.tools[action] !== 'function') {
		return;
	}

	const uids = await user.getUidsFromSet('users:online', 0, -1);

	await Promise.all(tids.map(async function (tid) {
		const title = await topics.getTopicField(tid, 'title');
		const data = await topics.tools[action](tid, caller.uid);
		const notifyUids = await privileges.categories.filterUids('topics:read', data.cid, uids);
		socketHelpers.emitToUids(event, data, notifyUids);
		await logTopicAction(action, caller, tid, title);
	}));
};

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
