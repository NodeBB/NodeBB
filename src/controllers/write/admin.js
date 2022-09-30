'use strict';

const db = require('../../database');
const meta = require('../../meta');
const privileges = require('../../privileges');
const analytics = require('../../analytics');
const messaging = require('../../messaging');
const events = require('../../events');

const helpers = require('../helpers');

const Admin = module.exports;

Admin.updateSetting = async (req, res) => {
	const ok = await privileges.admin.can('admin:settings', req.uid);

	if (!ok) {
		return helpers.formatApiResponse(403, res);
	}

	await meta.configs.set(req.params.setting, req.body.value);
	helpers.formatApiResponse(200, res);
};

Admin.getAnalyticsKeys = async (req, res) => {
	let keys = await analytics.getKeys();

	// Sort keys alphabetically
	keys = keys.sort((a, b) => (a < b ? -1 : 1));

	helpers.formatApiResponse(200, res, { keys });
};

Admin.getAnalyticsData = async (req, res) => {
	// Default returns views from past 24 hours, by hour
	if (!req.query.amount) {
		if (req.query.units === 'days') {
			req.query.amount = 30;
		} else {
			req.query.amount = 24;
		}
	}
	const getStats = req.query.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
	helpers.formatApiResponse(200, res, await getStats(`analytics:${req.params.set}`, parseInt(req.query.until, 10) || Date.now(), req.query.amount));
};

Admin.chats = {};

Admin.chats.getRooms = async (req, res) => {
	const page = (isFinite(req.query.page) && parseInt(req.query.page, 10)) || 1;
	const perPage = (isFinite(req.query.perPage) && parseInt(req.query.perPage, 10)) || 20;
	const start = Math.max(0, page - 1) * perPage;
	const stop = start + perPage;
	const roomIds = await db.getSortedSetRevRange('chat:rooms', start, stop);

	helpers.formatApiResponse(200, res, {
		rooms: await messaging.getRoomsData(roomIds),
	});
};

Admin.chats.deleteRoom = async (req, res) => {
	await messaging.deleteRooms([req.params.roomId]);

	events.log({
		type: 'chat-room-deleted',
		uid: req.uid,
		ip: req.ip,
	});
	helpers.formatApiResponse(200, res);
};
