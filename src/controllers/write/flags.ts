'use strict';

import user from '../../user';
import flags from '../../flags';
import api from '../../api';
import helpers from '../helpers';

const Flags = {} as any;

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

Flags.delete = async (req, res) => {
	await flags.purge([req.params.flagId]);
	helpers.formatApiResponse(200, res);
};

Flags.appendNote = async (req, res) => {
	const payload = await api.flags.appendNote(req, {
		flagId: req.params.flagId,
		...req.body,
	});

	helpers.formatApiResponse(200, res, payload);
};

Flags.deleteNote = async (req, res) => {
	const payload = await api.flags.deleteNote(req, {
		...req.params,
	});

	helpers.formatApiResponse(200, res, payload);
};

export default Flags;