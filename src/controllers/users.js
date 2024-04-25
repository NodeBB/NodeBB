'use strict';

const user = require('../user');
const meta = require('../meta');

const db = require('../database');
const pagination = require('../pagination');
const privileges = require('../privileges');
const helpers = require('./helpers');
const api = require('../api');
const utils = require('../utils');

const usersController = module.exports;

usersController.index = async function (req, res, next) {
	const section = req.query.section || 'joindate';
	const sectionToController = {
		joindate: usersController.getUsersSortedByJoinDate,
		online: usersController.getOnlineUsers,
		'sort-posts': usersController.getUsersSortedByPosts,
		'sort-reputation': usersController.getUsersSortedByReputation,
		banned: usersController.getBannedUsers,
		flagged: usersController.getFlaggedUsers,
	};

	if (req.query.query) {
		await usersController.search(req, res, next);
	} else if (sectionToController.hasOwnProperty(section) && sectionToController[section]) {
		await sectionToController[section](req, res, next);
	} else {
		await usersController.getUsersSortedByJoinDate(req, res, next);
	}
};

usersController.search = async function (req, res) {
	const searchData = await api.users.search(req, req.query);

	const section = req.query.section || 'joindate';

	searchData.pagination = pagination.create(req.query.page, searchData.pageCount, req.query);
	searchData[`section_${section}`] = true;
	searchData.displayUserSearch = true;
	await render(req, res, searchData);
};

usersController.getOnlineUsers = async function (req, res) {
	const [userData, guests] = await Promise.all([
		usersController.getUsers('users:online', req.uid, req.query),
		require('../socket.io/admin/rooms').getTotalGuestCount(),
	]);

	let hiddenCount = 0;
	if (!userData.isAdminOrGlobalMod) {
		userData.users = userData.users.filter((user) => {
			const showUser = user && (user.uid === req.uid || user.userStatus !== 'offline');
			if (!showUser) {
				hiddenCount += 1;
			}
			return showUser;
		});
	}

	userData.anonymousUserCount = guests + hiddenCount;

	await render(req, res, userData);
};

usersController.getUsersSortedByPosts = async function (req, res) {
	await usersController.renderUsersPage('users:postcount', req, res);
};

usersController.getUsersSortedByReputation = async function (req, res, next) {
	if (meta.config['reputation:disabled']) {
		return next();
	}
	await usersController.renderUsersPage('users:reputation', req, res);
};

usersController.getUsersSortedByJoinDate = async function (req, res) {
	await usersController.renderUsersPage('users:joindate', req, res);
};

usersController.getBannedUsers = async function (req, res) {
	await renderIfAdminOrGlobalMod('users:banned', req, res);
};

usersController.getFlaggedUsers = async function (req, res) {
	await renderIfAdminOrGlobalMod('users:flags', req, res);
};

async function renderIfAdminOrGlobalMod(set, req, res) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return helpers.notAllowed(req, res);
	}
	await usersController.renderUsersPage(set, req, res);
}

usersController.renderUsersPage = async function (set, req, res) {
	const userData = await usersController.getUsers(set, req.uid, req.query);
	await render(req, res, userData);
};

usersController.getUsers = async function (set, uid, query) {
	const setToData = {
		'users:postcount': { title: '[[pages:users/sort-posts]]', crumb: '[[users:top-posters]]' },
		'users:reputation': { title: '[[pages:users/sort-reputation]]', crumb: '[[users:most-reputation]]' },
		'users:joindate': { title: '[[pages:users/latest]]', crumb: '[[global:users]]' },
		'users:online': { title: '[[pages:users/online]]', crumb: '[[global:online]]' },
		'users:banned': { title: '[[pages:users/banned]]', crumb: '[[user:banned]]' },
		'users:flags': { title: '[[pages:users/most-flags]]', crumb: '[[users:most-flags]]' },
	};

	if (!setToData[set]) {
		setToData[set] = { title: '', crumb: '' };
	}

	const breadcrumbs = [{ text: setToData[set].crumb }];

	if (set !== 'users:joindate') {
		breadcrumbs.unshift({ text: '[[global:users]]', url: '/users' });
	}

	const page = parseInt(query.page, 10) || 1;
	const resultsPerPage = meta.config.userSearchResultsPerPage;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	const [isAdmin, isGlobalMod, canSearch, usersData] = await Promise.all([
		user.isAdministrator(uid),
		user.isGlobalModerator(uid),
		privileges.global.can('search:users', uid),
		usersController.getUsersAndCount(set, uid, start, stop),
	]);
	const pageCount = Math.ceil(usersData.count / resultsPerPage);
	return {
		users: usersData.users,
		pagination: pagination.create(page, pageCount, query),
		userCount: usersData.count,
		title: setToData[set].title || '[[pages:users/latest]]',
		breadcrumbs: helpers.buildBreadcrumbs(breadcrumbs),
		isAdminOrGlobalMod: isAdmin || isGlobalMod,
		isAdmin: isAdmin,
		isGlobalMod: isGlobalMod,
		displayUserSearch: canSearch,
		[`section_${query.section || 'joindate'}`]: true,
	};
};

usersController.getUsersAndCount = async function (set, uid, start, stop) {
	async function getCount() {
		if (set === 'users:online') {
			return await db.sortedSetCount('users:online', Date.now() - 86400000, '+inf');
		} else if (set === 'users:banned' || set === 'users:flags') {
			return await db.sortedSetCard(set);
		}
		return await db.getObjectField('global', 'userCount');
	}
	async function getUsers() {
		if (set === 'users:online') {
			const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
			const data = await db.getSortedSetRevRangeByScoreWithScores(set, start, count, '+inf', Date.now() - 86400000);
			const uids = data.map(d => d.value);
			const scores = data.map(d => d.score);
			const [userStatus, userData] = await Promise.all([
				db.getObjectsFields(uids.map(uid => `user:${uid}`), ['status']),
				user.getUsers(uids, uid),
			]);

			userData.forEach((user, i) => {
				if (user) {
					user.lastonline = scores[i];
					user.lastonlineISO = utils.toISOString(user.lastonline);
					user.userStatus = userStatus[i].status || 'online';
				}
			});
			return userData;
		}
		return await user.getUsersFromSet(set, uid, start, stop);
	}
	const [usersData, count] = await Promise.all([
		getUsers(),
		getCount(),
	]);
	return {
		users: usersData.filter(user => user && parseInt(user.uid, 10)),
		count: count,
	};
};

async function render(req, res, data) {
	const { registrationType } = meta.config;

	data.maximumInvites = meta.config.maximumInvites;
	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';
	data.invites = await user.getInvitesNumber(req.uid);

	data.showInviteButton = false;
	if (data.adminInviteOnly) {
		data.showInviteButton = await privileges.users.isAdministrator(req.uid);
	} else if (req.loggedIn) {
		const canInvite = await privileges.users.hasInvitePrivilege(req.uid);
		data.showInviteButton = canInvite && (!data.maximumInvites || data.invites < data.maximumInvites);
	}

	data['reputation:disabled'] = meta.config['reputation:disabled'];

	res.append('X-Total-Count', data.userCount);
	res.render('users', data);
}
