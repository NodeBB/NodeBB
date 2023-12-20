'use strict';

const nconf = require('nconf');
const path = require('path');
const crypto = require('crypto');

const api = require('../../api');
const user = require('../../user');

const helpers = require('../helpers');

const Users = module.exports;

Users.redirectBySlug = async (req, res) => {
	const uid = await user.getUidByUserslug(req.params.userslug);

	if (uid) {
		const path = req.path.split('/').slice(3).join('/');
		const urlObj = new URL(nconf.get('url') + req.url);
		res.redirect(308, nconf.get('relative_path') + encodeURI(`/api/v3/users/${uid}/${path}${urlObj.search}`));
	} else {
		helpers.formatApiResponse(404, res);
	}
};

Users.create = async (req, res) => {
	const userObj = await api.users.create(req, req.body);
	helpers.formatApiResponse(200, res, userObj);
};

Users.exists = async (req, res) => {
	helpers.formatApiResponse(200, res);
};

Users.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.users.get(req, { ...req.params }));
};

Users.update = async (req, res) => {
	const userObj = await api.users.update(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res, userObj);
};

Users.delete = async (req, res) => {
	await api.users.delete(req, { ...req.params, password: req.body.password });
	helpers.formatApiResponse(200, res);
};

Users.deleteContent = async (req, res) => {
	await api.users.deleteContent(req, { ...req.params, password: req.body.password });
	helpers.formatApiResponse(200, res);
};

Users.deleteAccount = async (req, res) => {
	await api.users.deleteAccount(req, { ...req.params, password: req.body.password });
	helpers.formatApiResponse(200, res);
};

Users.deleteMany = async (req, res) => {
	await api.users.deleteMany(req, req.body);
	helpers.formatApiResponse(200, res);
};

Users.changePicture = async (req, res) => {
	await api.users.changePicture(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.getStatus = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.users.getStatus(req, { ...req.params }));
};

Users.checkStatus = async (req, res) => {
	const { uid, status } = req.params;
	const { status: current } = await api.users.getStatus(req, { uid });

	helpers.formatApiResponse(current === status ? 200 : 404, res);
};

Users.getPrivateRoomId = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.users.getPrivateRoomId(req, { ...req.params }));
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

Users.mute = async (req, res) => {
	await api.users.mute(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.unmute = async (req, res) => {
	await api.users.unmute(req, { ...req.body, uid: req.params.uid });
	helpers.formatApiResponse(200, res);
};

Users.generateToken = async (req, res) => {
	const { description } = req.body;
	const token = await api.users.generateToken(req, { description, ...req.params });
	helpers.formatApiResponse(200, res, token);
};

Users.deleteToken = async (req, res) => {
	const ok = await api.users.deleteToken(req, { ...req.params });
	helpers.formatApiResponse(ok ? 200 : 404, res);
};

Users.revokeSession = async (req, res) => {
	await api.users.revokeSession(req, { ...req.params });
	helpers.formatApiResponse(200, res);
};

Users.invite = async (req, res) => {
	const { emails, groupsToJoin = [] } = req.body;

	try {
		await api.users.invite(req, { emails, groupsToJoin, ...req.params });
		helpers.formatApiResponse(200, res);
	} catch (e) {
		if (e.message.startsWith('[[error:invite-maximum-met')) {
			return helpers.formatApiResponse(403, res, e);
		}

		throw e;
	}
};

Users.getInviteGroups = async function (req, res) {
	return helpers.formatApiResponse(200, res, await api.users.getInviteGroups(req, { ...req.params }));
};

Users.addEmail = async (req, res) => {
	const { email, skipConfirmation } = req.body;
	const emails = await api.users.addEmail(req, { email, skipConfirmation, ...req.params });

	helpers.formatApiResponse(200, res, { emails });
};

Users.listEmails = async (req, res) => {
	const emails = await api.users.listEmails(req, { ...req.params });
	if (emails) {
		helpers.formatApiResponse(200, res, { emails });
	} else {
		helpers.formatApiResponse(204, res);
	}
};

Users.getEmail = async (req, res) => {
	const ok = await api.users.getEmail(req, { ...req.params });
	helpers.formatApiResponse(ok ? 204 : 404, res);
};

Users.confirmEmail = async (req, res) => {
	const ok = await api.users.confirmEmail(req, {
		sessionId: req.session.id,
		...req.params,
	});
	helpers.formatApiResponse(ok ? 200 : 404, res);
};

Users.checkExportByType = async (req, res) => {
	const stat = await api.users.checkExportByType(req, { ...req.params });
	const modified = new Date(stat.mtimeMs);
	res.set('Last-Modified', modified.toUTCString());
	res.set('ETag', `"${crypto.createHash('md5').update(String(stat.mtimeMs)).digest('hex')}"`);
	res.sendStatus(204);
};

Users.getExportByType = async (req, res, next) => {
	const data = await api.users.getExportByType(req, ({ ...req.params }));
	if (!data) {
		return next();
	}

	res.status(200);
	res.sendFile(data.filename, {
		root: path.join(__dirname, '../../../build/export'),
		headers: {
			'Content-Type': data.mime,
			'Content-Disposition': `attachment; filename=${data.filename}`,
		},
	}, (err) => {
		if (err) {
			throw err;
		}
	});
};

Users.generateExportsByType = async (req, res) => {
	await api.users.generateExport(req, req.params);
	helpers.formatApiResponse(202, res);
};
