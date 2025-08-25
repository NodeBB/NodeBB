'use strict';

const categories = require('../../categories');
const api = require('../../api');
const helpers = require('../helpers');
const messaging = require('../../messaging');
const events = require('../../events');
const activitypub = require('../../activitypub');

const Admin = module.exports;

Admin.updateSetting = async (req, res) => {
	await api.admin.updateSetting(req, {
		setting: req.params.setting,
		value: req.body.value,
	});

	helpers.formatApiResponse(200, res);
};

Admin.getAnalyticsKeys = async (req, res) => {
	helpers.formatApiResponse(200, res, {
		keys: await api.admin.getAnalyticsKeys(),
	});
};

Admin.getAnalyticsData = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.admin.getAnalyticsData(req, {
		set: req.params.set,
		until: parseInt(req.query.until, 10) || Date.now(),
		amount: req.query.amount,
		units: req.query.units,
	}));
};

Admin.generateToken = async (req, res) => {
	const { uid, description } = req.body;
	const token = await api.utils.tokens.generate({ uid, description });
	helpers.formatApiResponse(200, res, await api.utils.tokens.get(token));
};

Admin.getToken = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.utils.tokens.get(req.params.token));
};

Admin.updateToken = async (req, res) => {
	const { uid, description } = req.body;
	const { token } = req.params;

	helpers.formatApiResponse(200, res, await api.utils.tokens.update(token, { uid, description }));
};

Admin.rollToken = async (req, res) => {
	let { token } = req.params;

	token = await api.utils.tokens.roll(token);
	helpers.formatApiResponse(200, res, await api.utils.tokens.get(token));
};

Admin.deleteToken = async (req, res) => {
	const { token } = req.params;
	helpers.formatApiResponse(200, res, await api.utils.tokens.delete(token));
};

Admin.chats = {};

Admin.chats.deleteRoom = async (req, res) => {
	const roomData = await messaging.getRoomData(req.params.roomId);
	if (!roomData) {
		throw new Error('[[error:no-room]]');
	}
	await messaging.deleteRooms([req.params.roomId]);

	events.log({
		type: 'chat-room-deleted',
		roomId: req.params.roomId,
		roomName: roomData.roomName ? roomData.roomName : `No room name`,
		uid: req.uid,
		ip: req.ip,
	});
	helpers.formatApiResponse(200, res);
};

Admin.listGroups = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.admin.listGroups());
};

Admin.activitypub = {};

Admin.activitypub.addRule = async (req, res) => {
	const { type, value, cid } = req.body;
	const exists = await categories.exists(cid);
	if (!value || !exists) {
		return helpers.formatApiResponse(400, res);
	}

	await activitypub.rules.add(type, value, cid);
	helpers.formatApiResponse(200, res, await activitypub.rules.list());
};

Admin.activitypub.deleteRule = async (req, res) => {
	const { rid } = req.params;
	await activitypub.rules.delete(rid);
	helpers.formatApiResponse(200, res, await activitypub.rules.list());
};

Admin.activitypub.addRelay = async (req, res) => {
	const { url } = req.body;

	await activitypub.relays.add(url);
	helpers.formatApiResponse(200, res, await activitypub.relays.list());
};

Admin.activitypub.removeRelay = async (req, res) => {
	const { url } = req.params;

	await activitypub.relays.remove(url);
	helpers.formatApiResponse(200, res, await activitypub.relays.list());
};
