'use strict';

const api = require('../../api');

const helpers = require('../helpers');

const Notifications = module.exports;

Notifications.get = async (req, res) => {
	let response;
	if (req.params.nid) {
		response = await api.notifications.get(req, { ...req.params });
	} else {
		response = await api.notifications.list(req);
	}

	helpers.formatApiResponse(200, res, response);
};

Notifications.getCount = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.notifications.getCount(req));
};
