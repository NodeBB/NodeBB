'use strict';

const util = require('util');
const nconf = require('nconf');

const db = require('../../database');
const api = require('../../api');
const user = require('../../user');
const meta = require('../../meta');
const privileges = require('../../privileges');
const utils = require('../../utils');

const helpers = require('../helpers');

const Users = module.exports;

const hasAdminPrivilege = async (uid, privilege) => {
	const ok = await privileges.admin.can(`admin:${privilege}`, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}
};

Users.redirectBySlug = async (req, res) => {
	const uid = await user.getUidByUserslug(req.params.userslug);

	if (uid) {
		const path = req.path.split('/').slice(3).join('/');
		res.redirect(308, nconf.get('relative_path') + encodeURI(`/api/v3/users/${uid}/${path}`));
	} else {
		helpers.formatApiResponse(404, res);
	}
};

Users.create = async (req, res) => {
	await hasAdminPrivilege(req.uid, 'users');
	const userObj = await api.users.create(req, req.body);
	helpers.formatApiResponse(200, res, userObj);
};

Users.exists = async (req, res) => {
	helpers.formatApiResponse(200, res);
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
	await hasAdminPrivilege(req.uid, 'users');
	await api.users.deleteMany(req, req.body);
	helpers.formatApiResponse(200, res);
};

Users.updateSettings = async (req, res) => {
	const settings = await api.users.updateSettings(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res, settings);
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
	await hasAdminPrivilege(req.uid, 'settings');
	if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
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
	await hasAdminPrivilege(req.uid, 'settings');
	if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
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

const getSessionAsync = util.promisify(function (sid, callback) {
	db.sessionStore.get(sid, (err, sessionObj) => callback(err, sessionObj || null));
});

Users.revokeSession = async (req, res) => {
	// Only admins or global mods (besides the user themselves) can revoke sessions
	if (parseInt(req.params.uid, 10) !== req.uid && !await user.isAdminOrGlobalMod(req.uid)) {
		return helpers.formatApiResponse(404, res);
	}

	const sids = await db.getSortedSetRange('uid:' + req.params.uid + ':sessions', 0, -1);
	let _id;
	for (const sid of sids) {
		/* eslint-disable no-await-in-loop */
		const sessionObj = await getSessionAsync(sid);
		if (sessionObj && sessionObj.meta && sessionObj.meta.uuid === req.params.uuid) {
			_id = sid;
			break;
		}
	}

	if (!_id) {
		throw new Error('[[error:no-session-found]]');
	}

	await user.auth.revokeSession(_id, req.params.uid);
	helpers.formatApiResponse(200, res);
};
