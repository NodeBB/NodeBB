'use strict';

const api = require('../../api');
const messaging = require('../../messaging');

const helpers = require('../helpers');

const Chats = module.exports;

Chats.list = async (req, res) => {
	const page = (isFinite(req.query.page) && parseInt(req.query.page, 10)) || 1;
	const perPage = (isFinite(req.query.perPage) && parseInt(req.query.perPage, 10)) || 20;
	const start = Math.max(0, page - 1) * perPage;
	const stop = start + perPage;
	const { rooms } = await messaging.getRecentChats(req.uid, req.uid, start, stop);

	helpers.formatApiResponse(200, res, { rooms });
};

Chats.create = async (req, res) => {
	const roomObj = await api.chats.create(req, req.body);
	helpers.formatApiResponse(200, res, roomObj);
};

Chats.exists = async (req, res) => {
	helpers.formatApiResponse(200, res);
};

Chats.get = async (req, res) => {
	const roomObj = await messaging.loadRoom(req.uid, {
		uid: req.query.uid || req.uid,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, roomObj);
};

Chats.post = async (req, res) => {
	const messageObj = await api.chats.post(req, {
		...req.body,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, messageObj);
};

Chats.rename = async (req, res) => {
	const roomObj = await api.chats.rename(req, {
		...req.body,
		roomId: req.params.roomId,
	});

	helpers.formatApiResponse(200, res, roomObj);
};

Chats.users = async (req, res) => {
	const users = await api.chats.users(req, {
		...req.params,
	});
	helpers.formatApiResponse(200, res, users);
};

Chats.invite = async (req, res) => {
	// ...
};

Chats.kick = async (req, res) => {
	// ...
};

Chats.messages = {};
Chats.messages.get = async (req, res) => {
	const messages = await messaging.getMessagesData([req.params.mid], req.uid, req.params.roomId, false);
	helpers.formatApiResponse(200, res, messages.pop());
};

Chats.messages.edit = async (req, res) => {
	await messaging.canEdit(req.params.mid, req.uid);
	await messaging.editMessage(req.uid, req.params.mid, req.params.roomId, req.body.message);

	const messages = await messaging.getMessagesData([req.params.mid], req.uid, req.params.roomId, false);
	helpers.formatApiResponse(200, res, messages.pop());
};

Chats.messages.delete = async (req, res) => {
	await messaging.canDelete(req.params.mid, req.uid);
	await messaging.deleteMessage(req.params.mid, req.uid);

	helpers.formatApiResponse(200, res);
};

Chats.messages.restore = async (req, res) => {
	await messaging.canDelete(req.params.mid, req.uid);
	await messaging.restoreMessage(req.params.mid, req.uid);

	helpers.formatApiResponse(200, res);
};
