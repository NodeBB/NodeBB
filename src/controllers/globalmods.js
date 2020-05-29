'use strict';

const user = require('../user');
const meta = require('../meta');
const analytics = require('../analytics');
const usersController = require('./admin/users');

const globalModsController = module.exports;

globalModsController.ipBlacklist = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}

	const [rules, analyticsData] = await Promise.all([
		meta.blacklist.get(),
		analytics.getBlacklistAnalytics(),
	]);
	res.render('admin/manage/ip-blacklist', {
		title: '[[pages:ip-blacklist]]',
		rules: rules,
		analytics: analyticsData,
	});
};


globalModsController.registrationQueue = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}
	await usersController.registrationQueue(req, res);
};
