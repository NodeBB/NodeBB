'use strict';

const db = require('../../database');
const api = require('../../api');
const topics = require('../../topics');

const helpers = require('../helpers');
const middleware = require('../../middleware');
const uploadsController = require('../uploads');

const Topics = module.exports;

Topics.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.topics.get(req, req.params));
};

Topics.create = async (req, res) => {
	const id = await lockPosting(req, '[[error:already-posting]]');
	try {
		const payload = await api.topics.create(req, req.body);
		if (payload.queued) {
			helpers.formatApiResponse(202, res, payload);
		} else {
			helpers.formatApiResponse(200, res, payload);
		}
	} finally {
		await db.deleteObjectField('locks', id);
	}
};

Topics.reply = async (req, res) => {
	const id = await lockPosting(req, '[[error:already-posting]]');
	try {
		const payload = await api.topics.reply(req, { ...req.body, tid: req.params.tid });
		helpers.formatApiResponse(200, res, payload);
	} finally {
		await db.deleteObjectField('locks', id);
	}
};

async function lockPosting(req, error) {
	const id = req.uid > 0 ? req.uid : req.sessionID;
	const value = `posting${id}`;
	const count = await db.incrObjectField('locks', value);
	if (count > 1) {
		throw new Error(error);
	}
	return value;
}

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
	const { expiry } = req.body;
	await api.topics.pin(req, { tids: [req.params.tid], expiry });

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

Topics.updateTags = async (req, res) => {
	const payload = await api.topics.updateTags(req, {
		tid: req.params.tid,
		tags: req.body.tags,
	});
	helpers.formatApiResponse(200, res, payload);
};

Topics.addTags = async (req, res) => {
	const payload = await api.topics.addTags(req, {
		tid: req.params.tid,
		tags: req.body.tags,
	});

	helpers.formatApiResponse(200, res, payload);
};

Topics.deleteTags = async (req, res) => {
	await api.topics.deleteTags(req, { tid: req.params.tid });
	helpers.formatApiResponse(200, res);
};

Topics.getThumbs = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.topics.getThumbs(req, { ...req.params }));
};

Topics.addThumb = async (req, res) => {
	// todo: move controller logic to src/api/topics.js
	await api.topics._checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid });

	const files = await uploadsController.uploadThumb(req, res); // response is handled here

	// Add uploaded files to topic zset
	if (files && files.length) {
		await Promise.all(files.map(async (fileObj) => {
			await topics.thumbs.associate({
				id: req.params.tid,
				path: fileObj.path || fileObj.url,
			});
		}));
	}
};

Topics.migrateThumbs = async (req, res) => {
	await api.topics.migrateThumbs(req, {
		from: req.params.tid,
		to: req.body.tid,
	});

	helpers.formatApiResponse(200, res, await api.topics.getThumbs(req, { tid: req.body.tid }));
};

Topics.deleteThumb = async (req, res) => {
	if (!req.body.path.startsWith('http')) {
		await middleware.assert.path(req, res, () => {});
		if (res.headersSent) {
			return;
		}
	}

	await api.topics.deleteThumb(req, {
		tid: req.params.tid,
		path: req.body.path,
	});
	helpers.formatApiResponse(200, res, await topics.thumbs.get(req.params.tid));
};

Topics.reorderThumbs = async (req, res) => {
	const { path, order } = req.body;
	await api.topics.reorderThumbs(req, {
		path,
		order,
		...req.params,
	});

	helpers.formatApiResponse(200, res, await topics.thumbs.get(req.params.tid));
};

Topics.getEvents = async (req, res) => {
	const events = await api.topics.getEvents(req, { ...req.params });

	helpers.formatApiResponse(200, res, { events });
};

Topics.deleteEvent = async (req, res) => {
	await api.topics.deleteEvent(req, { ...req.params });

	helpers.formatApiResponse(200, res);
};

Topics.markRead = async (req, res) => {
	await api.topics.markRead(req, { ...req.params });

	helpers.formatApiResponse(200, res);
};

Topics.markUnread = async (req, res) => {
	await api.topics.markUnread(req, { ...req.params });

	helpers.formatApiResponse(200, res);
};

Topics.bump = async (req, res) => {
	await api.topics.bump(req, { ...req.params });

	helpers.formatApiResponse(200, res);
};
