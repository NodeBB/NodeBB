'use strict';

const user = require('../user');
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
			const isPrivileged = await user.isAdminOrGlobalMod(callerUid);
			const settings = await user.getSettings(uid);
			if (!isPrivileged && (settings && !settings.showemail)) {
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

	let userData = await user.getUserData(uid);
	if (!userData) {
		throw new Error('[[error:no-user]]');
	}

	userData = await user.hidePrivateData(userData, callerUid);

	return userData;
};

require('../promisify')(userController, [
	'getCurrentUser', 'getUserByUID', 'getUserByUsername', 'getUserByEmail',
]);
