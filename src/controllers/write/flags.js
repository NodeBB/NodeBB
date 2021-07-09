'use strict';

const user = require('../../user');
const flags = require('../../flags');
const api = require('../../api');
const helpers = require('../helpers');

const Flags = module.exports;

Flags.create = async (req, res) => {
	const flagObj = await api.flags.create(req, { ...req.body });
	helpers.formatApiResponse(200, res, await user.isPrivileged(req.uid) ? flagObj : undefined);
};

Flags.get = async (req, res) => {
	const isPrivileged = await user.isPrivileged(req.uid);
	if (!isPrivileged) {
		return helpers.formatApiResponse(403, res);
	}

	helpers.formatApiResponse(200, res, await flags.get(req.params.flagId));
};

Flags.update = async (req, res) => {
	const history = await api.flags.update(req, {
		flagId: req.params.flagId,
		...req.body,
	});

	helpers.formatApiResponse(200, res, { history });
};
