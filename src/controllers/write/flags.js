'use strict';

const user = require('../../user');
const api = require('../../api');
const helpers = require('../helpers');

const Flags = module.exports;

Flags.create = async (req, res) => {
	const { type, id, reason } = req.body;
	const flagObj = await api.flags.create(req, { type, id, reason });
	helpers.formatApiResponse(200, res, await user.isPrivileged(req.uid) ? flagObj : undefined);
};

Flags.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.flags.get(req, req.params));
};

Flags.update = async (req, res) => {
	const { state, assignee } = req.body;
	const history = await api.flags.update(req, {
		flagId: req.params.flagId,
		state,
		assignee,
	});

	helpers.formatApiResponse(200, res, { history });
};

Flags.delete = async (req, res) => {
	await api.flags.delete(req, { flagId: req.params.flagId });
	helpers.formatApiResponse(200, res);
};

Flags.rescind = async (req, res) => {
	await api.flags.rescind(req, { flagId: req.params.flagId });
	helpers.formatApiResponse(200, res);
};

Flags.appendNote = async (req, res) => {
	const { note, datetime } = req.body;
	const payload = await api.flags.appendNote(req, {
		flagId: req.params.flagId,
		note,
		datetime,
	});

	helpers.formatApiResponse(200, res, payload);
};

Flags.deleteNote = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.flags.deleteNote(req, req.params));
};
