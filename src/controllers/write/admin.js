'use strict';

const meta = require('../../meta');
const privileges = require('../../privileges');
const analytics = require('../../analytics');

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
