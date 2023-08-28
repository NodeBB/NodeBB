'use strict';

const api = require('../../api');
const helpers = require('../helpers');

const Chats = module.exports;

Chats.list = async (req, res) => {
	const page = (isFinite(req.query.page) && parseInt(req.query.page, 10)) || 1;
	const perPage = (isFinite(req.query.perPage) && parseInt(req.query.perPage, 10)) || 20;
	const { rooms } = await api.chats.list(req, { page, perPage });

	helpers.formatApiResponse(200, res, { rooms });
};

Chats.create = async (req, res) => {
	const roomObj = await api.chats.create(req, req.body);
	helpers.formatApiResponse(200, res, roomObj);
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

Chats.messages = {};
Chats.messages.list = async (req, res) => {
	const uid = req.query.uid || req.uid;
	const { roomId } = req.params;
	const start = parseInt(req.query.start, 10) || 0;
	const { messages } = await api.chats.listMessages(req, { uid, roomId, start });

	helpers.formatApiResponse(200, res, { messages });
};

Chats.messages.get = async (req, res) => {
	const { mid, roomId } = req.params;

	helpers.formatApiResponse(200, res, await api.chats.getMessage(req, { mid, roomId }));
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
