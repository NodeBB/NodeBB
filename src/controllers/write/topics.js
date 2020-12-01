'use strict';

const validator = require('validator');

const api = require('../../api');
const topics = require('../../topics');

const helpers = require('../helpers');
const uploadsController = require('../uploads');

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

Topics.addThumb = async (req, res) => {
	// req.params.tid could be either a tid (pushing a new thumb to an existing topic) or a post UUID (a new topic being composed)
	const id = req.params.tid;
	const isUUID = validator.isUUID(id);

	// Sanity-check the tid if it's strictly not a uuid
	if (!isUUID && (isNaN(parseInt(id, 10)) || !await topics.exists(req.params.tid))) {
		return helpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
	}
	/**
	 * todo test:
	 *   - uuid
	 *   - tid
	 *   - number but not tid
	 *   - random garbage
	 */

	const files = await uploadsController.uploadThumb(req, res);	// response is handled here, fix this?

	// Add uploaded files to topic zset
	await Promise.all(files.map(async (fileObj) => {
		await topics.thumbs.associate(id, fileObj.path, isUUID);
	}));
};

Topics.deleteThumb = async (req, res) => {
	await topics.thumbs.delete(req.params.tid, req.query.path);
	helpers.formatApiResponse(200, res, await topics.thumbs.get(req.params.tid));
};
