'use strict';

const user = require('../user');
const adminBlacklistController = require('./admin/blacklist');
const usersController = require('./admin/users');

const globalModsController = module.exports;

globalModsController.ipBlacklist = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}
	await adminBlacklistController.get(req, res);
};


globalModsController.registrationQueue = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}
	await usersController.registrationQueue(req, res);
};
