'use strict';

const api = require('../../api');
const helpers = require('../helpers');

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
