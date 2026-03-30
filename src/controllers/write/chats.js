'use strict';

const api = require('../../api');
const helpers = require('../helpers');

const Chats = module.exports;

Chats.list = async (req, res) => {
	let stop;
	let { page, perPage, start, uid } = req.query;
	([page, perPage, start, uid] = [page, perPage, start, uid].map(value => isFinite(value) && parseInt(value, 10)));
	page = page || 1;
	perPage = Math.min(100, perPage || 20);

	// start supercedes page
	if (start) {
		stop = start + perPage - 1;
	} else {
		start = Math.max(0, page - 1) * perPage;
		stop = start + perPage - 1;
	}

	const { rooms, nextStart } = await api.chats.list(req, { start, stop, uid });
	helpers.formatApiResponse(200, res, { rooms, nextStart });
};

Chats.create = async (req, res) => {
	const roomObj = await api.chats.create(req, req.body);
	helpers.formatApiResponse(200, res, roomObj);
};

// currently only returns unread count, but open-ended for future additions if warranted.
Chats.getUnread = async (req, res) => helpers.formatApiResponse(200, res, await api.chats.getUnread(req));

Chats.sortPublicRooms = async (req, res) => {
	const { roomIds, scores } = req.body;
	await api.chats.sortPublicRooms(req, { roomIds, scores });

	helpers.formatApiResponse(200, res);
};

Chats.exists = async (req, res) => {
	// yes, this is fine. Room existence is checked via middleware :)
	helpers.formatApiResponse(200, res);
};

Chats.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.chats.get(req, {
		uid: req.query.uid || req.uid,
		roomId: req.params.roomId,
	}));
};

Chats.post = async (req, res) => {
	const messageObj = await api.chats.post(req, {
		message: req.body.message,
		toMid: req.body.toMid,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, messageObj);
};

Chats.update = async (req, res) => {
	const payload = { ...req.body };
	payload.roomId = req.params.roomId;
	const roomObj = await api.chats.update(req, payload);

	helpers.formatApiResponse(200, res, roomObj);
};

Chats.rename = async (req, res) => {
	const roomObj = await api.chats.rename(req, {
		name: req.body.name,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, roomObj);
};

Chats.mark = async (req, res) => {
	const state = req.method === 'PUT' ? 1 : 0;
	await api.chats.mark(req, {
		roomId: req.params.roomId,
		state,
	});

	helpers.formatApiResponse(200, res);
};

Chats.watch = async (req, res) => {
	const state = req.method === 'DELETE' ? -1 : parseInt(req.body.value, 10) || -1;

	await api.chats.watch(req, { state, ...req.params });
	helpers.formatApiResponse(200, res);
};

Chats.toggleTyping = async (req, res) => {
	const { typing } = req.body;

	await api.chats.toggleTyping(req, { typing, ...req.params });
	helpers.formatApiResponse(200, res);
};

Chats.users = async (req, res) => {
	const { roomId } = req.params;
	const start = parseInt(req.query.start, 10) || 0;
	const users = await api.chats.users(req, { roomId, start });

	helpers.formatApiResponse(200, res, users);
};

Chats.invite = async (req, res) => {
	const { uids } = req.body;
	const users = await api.chats.invite(req, {
		uids,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, users);
};

Chats.kick = async (req, res) => {
	const { uids } = req.body;
	const users = await api.chats.kick(req, {
		uids,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, users);
};

Chats.kickUser = async (req, res) => {
	const uids = [req.params.uid];
	const users = await api.chats.kick(req, {
		uids,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, users);
};

Chats.toggleOwner = async (req, res) => {
	const state = req.method === 'PUT';
	await api.chats.toggleOwner(req, { state, ...req.params });
	helpers.formatApiResponse(200, res);
};

Chats.messages = {};
Chats.messages.list = async (req, res) => {
	const uid = req.query.uid || req.uid;
	const { roomId } = req.params;
	const start = parseInt(req.query.start, 10) || 0;
	const direction = parseInt(req.query.direction, 10) || null;
	const { messages } = await api.chats.listMessages(req, {
		uid, roomId, start, direction,
	});

	helpers.formatApiResponse(200, res, { messages });
};

Chats.messages.getPinned = async (req, res) => {
	const { start } = req.query;

	helpers.formatApiResponse(200, res, await api.chats.getPinnedMessages(req, { start, ...req.params }));
};

Chats.messages.get = async (req, res) => {
	const { mid, roomId } = req.params;

	helpers.formatApiResponse(200, res, await api.chats.getMessage(req, { mid, roomId }));
};

Chats.messages.getRaw = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.chats.getRawMessage(req, { ...req.params }));
};

Chats.messages.getIpAddress = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.chats.getIpAddress(req, { ...req.params }));
};

Chats.messages.edit = async (req, res) => {
	const { mid, roomId } = req.params;
	const { message } = req.body;
	await api.chats.editMessage(req, { mid, roomId, message });

	helpers.formatApiResponse(200, res, await api.chats.getMessage(req, { mid, roomId }));
};

Chats.messages.delete = async (req, res) => {
	const { mid } = req.params;
	await api.chats.deleteMessage(req, { mid });

	helpers.formatApiResponse(200, res);
};

Chats.messages.restore = async (req, res) => {
	const { mid } = req.params;
	await api.chats.restoreMessage(req, { mid });

	helpers.formatApiResponse(200, res);
};

Chats.messages.pin = async (req, res) => {
	const { mid, roomId } = req.params;
	await api.chats.pinMessage(req, { mid, roomId });

	helpers.formatApiResponse(200, res);
};

Chats.messages.unpin = async (req, res) => {
	const { mid, roomId } = req.params;
	await api.chats.unpinMessage(req, { mid, roomId });

	helpers.formatApiResponse(200, res);
};
