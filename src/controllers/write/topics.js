'use strict';

const validator = require('validator');

const api = require('../../api');
const topics = require('../../topics');
const privileges = require('../../privileges');

const helpers = require('../helpers');
const middleware = require('../../middleware');
const uploadsController = require('../uploads');

const Topics = module.exports;

Topics.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.topics.get(req, req.params));
};

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
	await api.topics.delete(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.restore = async (req, res) => {
	await api.topics.restore(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.purge = async (req, res) => {
	await api.topics.purge(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.pin = async (req, res) => {
	// Pin expiry was not available w/ sockets hence not included in api lib method
	if (req.body.expiry) {
		await topics.tools.setPinExpiry(req.params.tid, req.body.expiry, req.uid);
	}
	await api.topics.pin(req, {	tids: [req.params.tid] });

	helpers.formatApiResponse(200, res);
};

Topics.unpin = async (req, res) => {
	await api.topics.unpin(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.lock = async (req, res) => {
	await api.topics.lock(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.unlock = async (req, res) => {
	await api.topics.unlock(req, { tids: [req.params.tid] });
	helpers.formatApiResponse(200, res);
};

Topics.follow = async (req, res) => {
	await api.topics.follow(req, req.params);
	helpers.formatApiResponse(200, res);
};

Topics.ignore = async (req, res) => {
	await api.topics.ignore(req, req.params);
	helpers.formatApiResponse(200, res);
};

Topics.unfollow = async (req, res) => {
	await api.topics.unfollow(req, req.params);
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

Topics.getThumbs = async (req, res) => {
	helpers.formatApiResponse(200, res, await topics.thumbs.get(req.params.tid));
};

Topics.addThumb = async (req, res) => {
	await checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res });
	if (res.headersSent) {
		return;
	}

	const files = await uploadsController.uploadThumb(req, res);	// response is handled here

	// Add uploaded files to topic zset
	if (files && files.length) {
		await Promise.all(files.map(async (fileObj) => {
			await topics.thumbs.associate({
				id: req.params.tid,
				path: fileObj.path || null,
				url: fileObj.url,
			});
		}));
	}
};

Topics.migrateThumbs = async (req, res) => {
	await Promise.all([
		checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res }),
		checkThumbPrivileges({ tid: req.body.tid, uid: req.user.uid, res }),
	]);
	if (res.headersSent) {
		return;
	}

	await topics.thumbs.migrate(req.params.tid, req.body.tid);
	helpers.formatApiResponse(200, res);
};

Topics.deleteThumb = async (req, res) => {
	if (!req.body.path.startsWith('http')) {
		await middleware.assert.path(req, res, function () {});
		if (res.headersSent) {
			return;
		}
	}

	await checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res });
	if (res.headersSent) {
		return;
	}

	await topics.thumbs.delete(req.params.tid, req.body.path);
	helpers.formatApiResponse(200, res, await topics.thumbs.get(req.params.tid));
};

async function checkThumbPrivileges({ tid, uid, res }) {
	// req.params.tid could be either a tid (pushing a new thumb to an existing topic) or a post UUID (a new topic being composed)
	const isUUID = validator.isUUID(tid);

	// Sanity-check the tid if it's strictly not a uuid
	if (!isUUID && (isNaN(parseInt(tid, 10)) || !await topics.exists(tid))) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
	}

	// While drafts are not protected, tids are
	if (!isUUID && !await privileges.topics.canEdit(tid, uid)) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	}
}
