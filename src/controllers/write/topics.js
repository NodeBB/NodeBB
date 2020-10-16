'use strict';

const api = require('../../api');
const topics = require('../../topics');
const user = require('../../user');
const events = require('../../events');
const privileges = require('../../privileges');

const helpers = require('../helpers');
const socketHelpers = require('../../socket.io/helpers');

const Topics = module.exports;

Topics.create = async (req, res) => {
	const payload = await api.topics.create(req, req.body);
	if (payload.queued) {
		helpers.formatApiResponse(202, res, payload);
	} else {
		helpers.formatApiResponse(200, res, payload);
	}
};

Topics.reply = async (req, res) => {
	const payload = await api.topics.reply(req, { ...req.body, tid: req.params.tid });
	helpers.formatApiResponse(200, res, payload);
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

Topics.addTags = async (req, res) => {
	await topics.createTags(req.body.tags, req.params.tid, Date.now());
	helpers.formatApiResponse(200, res);
};

Topics.deleteTags = async (req, res) => {
	await topics.deleteTopicTags(req.params.tid);
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
		socketHelpers.emitToUids(event, data, notifyUids);
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
