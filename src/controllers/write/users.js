'use strict';

const api = require('../../api');
const meta = require('../../meta');
const utils = require('../../utils');

const helpers = require('../helpers');

const Users = module.exports;

Users.create = async (req, res) => {
	const userObj = await api.users.create(req, req.body);
	helpers.formatApiResponse(200, res, userObj);
};

Users.update = async (req, res) => {
	const userObj = await api.users.update(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res, userObj);
};

Users.delete = async (req, res) => {
	await api.users.delete(req, req.params);
	helpers.formatApiResponse(200, res);
};

Users.deleteMany = async (req, res) => {
	await api.users.deleteMany(req, req.body);
	helpers.formatApiResponse(200, res);
};

Users.updateSettings = async (req, res) => {
	const settings = await api.users.updateSettings(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res, settings);
};

Users.updateSetting = async (req, res) => {
	await api.users.updateSetting(req, { ...req.params, value: req.body.value });
	helpers.formatApiResponse(200, res);
};

Users.changePassword = async (req, res) => {
	await api.users.changePassword(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.follow = async (req, res) => {
	await api.users.follow(req, req.params);
	helpers.formatApiResponse(200, res);
};

Users.unfollow = async (req, res) => {
	await api.users.unfollow(req, req.params);
	helpers.formatApiResponse(200, res);
};

Users.ban = async (req, res) => {
	await api.users.ban(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.unban = async (req, res) => {
	await api.users.unban(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.generateToken = async (req, res) => {
	if (!res.locals.privileges['admin:settings']) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	} else if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
		return helpers.formatApiResponse(401, res);
	}

	const settings = await meta.settings.get('core.api');
	settings.tokens = settings.tokens || [];

	const newToken = {
		token: utils.generateUUID(),
		uid: req.user.uid,
		description: req.body.description || '',
		timestamp: Date.now(),
	};
	settings.tokens.push(newToken);
	await meta.settings.set('core.api', settings);
	helpers.formatApiResponse(200, res, newToken);
};

Users.deleteToken = async (req, res) => {
	if (!res.locals.privileges['admin:settings']) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	} else if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
		return helpers.formatApiResponse(401, res);
	}

	const settings = await meta.settings.get('core.api');
	const beforeLen = settings.tokens.length;
	settings.tokens = settings.tokens.filter(tokenObj => tokenObj.token !== req.params.token);
	if (beforeLen !== settings.tokens.length) {
		await meta.settings.set('core.api', settings);
		helpers.formatApiResponse(200, res);
	} else {
		helpers.formatApiResponse(404, res);
	}
};
