'use strict';

const path = require('path');

const user = require('../user');
const meta = require('../meta');
const privileges = require('../privileges');
const accountHelpers = require('./accounts/helpers');

const userController = module.exports;

userController.getCurrentUser = async function (req, res) {
	if (!req.loggedIn) {
		return res.status(401).json('not-authorized');
	}
	const userslug = await user.getUserField(req.uid, 'userslug');
	const userData = await accountHelpers.getUserDataByUserSlug(userslug, req.uid, req.query);
	res.json(userData);
};

userController.getUserByUID = async function (req, res, next) {
	await byType('uid', req, res, next);
};

userController.getUserByUsername = async function (req, res, next) {
	await byType('username', req, res, next);
};

userController.getUserByEmail = async function (req, res, next) {
	await byType('email', req, res, next);
};

async function byType(type, req, res, next) {
	const userData = await userController.getUserDataByField(req.uid, type, req.params[type]);
	if (!userData) {
		return next();
	}
	res.json(userData);
}

userController.getUserDataByField = async function (callerUid, field, fieldValue) {
	let uid = null;
	if (field === 'uid') {
		uid = fieldValue;
	} else if (field === 'username') {
		uid = await user.getUidByUsername(fieldValue);
	} else if (field === 'email') {
		uid = await user.getUidByEmail(fieldValue);
		if (uid) {
			const settings = await user.getSettings(uid);
			if (settings && !settings.showemail) {
				uid = 0;
			}
		}
	}
	if (!uid) {
		return null;
	}
	return await userController.getUserDataByUID(callerUid, uid);
};

userController.getUserDataByUID = async function (callerUid, uid) {
	if (!parseInt(uid, 10)) {
		throw new Error('[[error:no-user]]');
	}
	const canView = await privileges.global.can('view:users', callerUid);
	if (!canView) {
		throw new Error('[[error:no-privileges]]');
	}
	const [userData, settings] = await Promise.all([
		user.getUserData(uid),
		user.getSettings(uid),
	]);

	if (!userData) {
		throw new Error('[[error:no-user]]');
	}

	userData.email = settings.showemail && !meta.config.hideEmail ? userData.email : undefined;
	userData.fullname = settings.showfullname && !meta.config.hideFullname ? userData.fullname : undefined;

	return userData;
};

userController.exportPosts = async function (req, res, next) {
	sendExport(`${res.locals.uid}_posts.csv`, 'text/csv', res, next);
};

userController.exportUploads = function (req, res, next) {
	sendExport(`${res.locals.uid}_uploads.zip`, 'application/zip', res, next);
};

userController.exportProfile = async function (req, res, next) {
	sendExport(`${res.locals.uid}_profile.json`, 'application/json', res, next);
};

function sendExport(filename, type, res, next) {
	res.sendFile(filename, {
		root: path.join(__dirname, '../../build/export'),
		headers: {
			'Content-Type': type,
			'Content-Disposition': `attachment; filename=${filename}`,
		},
	}, (err) => {
		if (err) {
			if (err.code === 'ENOENT') {
				res.locals.isAPI = false;
				return next();
			}
			return next(err);
		}
	});
}

require('../promisify')(userController, [
	'getCurrentUser', 'getUserByUID', 'getUserByUsername', 'getUserByEmail',
	'exportPosts', 'exportUploads', 'exportProfile',
]);
