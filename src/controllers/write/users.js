'use strict';

const api = require('../../api');
const user = require('../../user');
const plugins = require('../../plugins');
const privileges = require('../../privileges');
const notifications = require('../../notifications');
const flags = require('../../flags');
const meta = require('../../meta');
const events = require('../../events');
const translator = require('../../translator');
const utils = require('../../utils');

const db = require('../../database');
const helpers = require('../helpers');
const sockets = require('../../socket.io');

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

Users.changePassword = async (req, res) => {
	req.body.uid = req.params.uid;
	await user.changePassword(req.user.uid, Object.assign(req.body, { ip: req.ip }));
	await events.log({
		type: 'password-change',
		uid: req.user.uid,
		targetUid: req.params.uid,
		ip: req.ip,
	});

	helpers.formatApiResponse(200, res);
};

Users.follow = async (req, res) => {
	await user.follow(req.user.uid, req.params.uid);
	plugins.fireHook('action:user.follow', {
		fromUid: req.user.uid,
		toUid: req.params.uid,
	});

	const userData = await user.getUserFields(req.user.uid, ['username', 'userslug']);
	const notifObj = await notifications.create({
		type: 'follow',
		bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
		nid: 'follow:' + req.params.uid + ':uid:' + req.user.uid,
		from: req.user.uid,
		path: '/uid/' + req.params.uid + '/followers',
		mergeId: 'notifications:user_started_following_you',
	});
	if (!notifObj) {
		return;
	}
	notifObj.user = userData;
	await notifications.push(notifObj, [req.params.uid]);

	helpers.formatApiResponse(200, res);
};

Users.unfollow = async (req, res) => {
	await user.unfollow(req.user.uid, req.params.uid);
	plugins.fireHook('action:user.unfollow', {
		fromUid: req.user.uid,
		toUid: req.params.uid,
	});
	helpers.formatApiResponse(200, res);
};

Users.ban = async (req, res) => {
	if (!await privileges.users.hasBanPrivilege(req.user.uid)) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	} else if (await user.isAdministrator(req.params.uid)) {
		return helpers.formatApiResponse(403, res, new Error('[[error:cant-ban-other-admins]]'));
	}

	const banData = await user.bans.ban(req.params.uid, req.body.until, req.body.reason);
	await db.setObjectField('uid:' + req.params.uid + ':ban:' + banData.timestamp, 'fromUid', req.user.uid);

	if (!req.body.reason) {
		req.body.reason = await translator.translate('[[user:info.banned-no-reason]]');
	}

	sockets.in('uid_' + req.params.uid).emit('event:banned', {
		until: req.body.until,
		reason: req.body.reason,
	});

	await flags.resolveFlag('user', req.params.uid, req.user.uid);
	await events.log({
		type: 'user-ban',
		uid: req.user.uid,
		targetUid: req.params.uid,
		ip: req.ip,
		reason: req.body.reason || undefined,
	});
	plugins.fireHook('action:user.banned', {
		callerUid: req.user.uid,
		ip: req.ip,
		uid: req.params.uid,
		until: req.body.until > 0 ? req.body.until : undefined,
		reason: req.body.reason || undefined,
	});
	await user.auth.revokeAllSessions(req.params.uid);

	helpers.formatApiResponse(200, res);
};

Users.unban = async (req, res) => {
	if (!await privileges.users.hasBanPrivilege(req.user.uid)) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	}

	await user.bans.unban(req.params.uid);
	await events.log({
		type: 'user-unban',
		uid: req.user.uid,
		targetUid: req.params.uid,
		ip: req.ip,
	});
	plugins.fireHook('action:user.unbanned', {
		callerUid: req.user.uid,
		ip: req.ip,
		uid: req.params.uid,
	});

	helpers.formatApiResponse(200, res);
};

Users.generateToken = async (req, res) => {
	if (!res.locals.privileges['admin:settings']) {
		return helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	} else if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
		return helpers.formatApiResponse(401, res);
	}

	const settings = await meta.settings.get('core.api');
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
