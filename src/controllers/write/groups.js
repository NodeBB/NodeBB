'use strict';

const api = require('../../api');

const helpers = require('../helpers');

const Groups = module.exports;

Groups.create = async (req, res) => {
	const groupObj = await api.groups.create(req, req.body);
	helpers.formatApiResponse(200, res, groupObj);
};

Groups.delete = async (req, res) => {
	await api.groups.delete(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.join = async (req, res) => {
	await api.groups.join(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.leave = async (req, res) => {
	await api.groups.leave(req, req.params);
	helpers.formatApiResponse(200, res);
};
