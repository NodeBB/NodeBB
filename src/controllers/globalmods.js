'use strict';

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const analytics = require('../analytics');
const helpers = require('./helpers');
const pagination = require('../pagination');
const plugins = require('../plugins');

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
	res.render('ip-blacklist', {
		title: '[[pages:ip-blacklist]]',
		rules: rules,
		analytics: analyticsData,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:ip-blacklist]]' }]),
	});
};


globalModsController.registrationQueue = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}
	const page = parseInt(req.query.page, 10) || 1;
	const itemsPerPage = 20;
	const start = (page - 1) * 20;
	const stop = start + itemsPerPage - 1;

	const [registrationQueueCount, users, customHeaders, invites] = await Promise.all([
		db.sortedSetCard('registration:queue'),
		user.getRegistrationQueue(start, stop),
		plugins.hooks.fire('filter:admin.registrationQueue.customHeaders', { headers: [] }),
		getInvites(),
	]);
	const pageCount = Math.max(1, Math.ceil(registrationQueueCount / itemsPerPage));

	res.render('registration-queue', {
		title: '[[pages:registration-queue]]',
		pagination: pagination.create(page, pageCount, req.query),
		customHeaders: customHeaders.headers,
		invites,
		users,
		registrationQueueCount,
	});
};

async function getInvites() {
	const invitations = await user.getAllInvites();
	const uids = invitations.map(invite => invite.uid);
	let usernames = await user.getUsersFields(uids, ['username']);
	usernames = usernames.map(user => user.username);

	invitations.forEach((invites, index) => {
		invites.username = usernames[index];
	});

	async function getUsernamesByEmails(emails) {
		const uids = await db.sortedSetScores('email:uid', emails.map(email => String(email).toLowerCase()));
		const usernames = await user.getUsersFields(uids, ['username']);
		return usernames.map(user => user.username);
	}

	usernames = await Promise.all(invitations.map(invites => getUsernamesByEmails(invites.invitations)));

	invitations.forEach((invites, index) => {
		invites.invitations = invites.invitations.map((email, i) => ({
			email: email,
			username: usernames[index][i] === '[[global:guest]]' ? '' : usernames[index][i],
		}));
	});
	return invitations;
}