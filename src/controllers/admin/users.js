'use strict';

const validator = require('validator');

const user = require('../../user');
const meta = require('../../meta');
const db = require('../../database');
const pagination = require('../../pagination');
const events = require('../../events');
const plugins = require('../../plugins');
const privileges = require('../../privileges');
const utils = require('../../utils');

const usersController = module.exports;

const userFields = [
	'uid', 'username', 'userslug', 'email', 'postcount', 'joindate', 'banned',
	'reputation', 'picture', 'flags', 'lastonline', 'email:confirmed',
];

usersController.index = async function (req, res) {
	if (req.query.query) {
		await usersController.search(req, res);
	} else {
		await getUsers(req, res);
	}
};

async function getUsers(req, res) {
	const sortDirection = req.query.sortDirection || 'desc';
	const reverse = sortDirection === 'desc';

	const page = parseInt(req.query.page, 10) || 1;
	let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
	if (![50, 100, 250, 500].includes(resultsPerPage)) {
		resultsPerPage = 50;
	}
	let sortBy = validator.escape(req.query.sortBy || '');
	const filterBy = Array.isArray(req.query.filters || []) ? (req.query.filters || []) : [req.query.filters];
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	function buildSet() {
		const sortToSet = {
			postcount: 'users:postcount',
			reputation: 'users:reputation',
			joindate: 'users:joindate',
			lastonline: 'users:online',
			flags: 'users:flags',
		};

		const set = [];
		if (sortBy) {
			set.push(sortToSet[sortBy]);
		}
		if (filterBy.includes('unverified')) {
			set.push('group:unverified-users:members');
		}
		if (filterBy.includes('verified')) {
			set.push('group:verified-users:members');
		}
		if (filterBy.includes('banned')) {
			set.push('users:banned');
		}
		if (!set.length) {
			set.push('users:online');
			sortBy = 'lastonline';
		}
		return set.length > 1 ? set : set[0];
	}

	async function getCount(set) {
		if (Array.isArray(set)) {
			return await db.sortedSetIntersectCard(set);
		}
		return await db.sortedSetCard(set);
	}

	async function getUids(set) {
		let uids = [];
		if (Array.isArray(set)) {
			const weights = set.map((s, index) => (index ? 0 : 1));
			uids = await db[reverse ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({
				sets: set,
				start: start,
				stop: stop,
				weights: weights,
			});
		} else {
			uids = await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
		}
		return uids;
	}

	async function getUsersWithFields(set) {
		const uids = await getUids(set);
		const [isAdmin, userData, lastonline] = await Promise.all([
			user.isAdministrator(uids),
			user.getUsersWithFields(uids, userFields, req.uid),
			db.sortedSetScores('users:online', uids),
		]);
		userData.forEach((user, index) => {
			if (user) {
				user.administrator = isAdmin[index];
				const timestamp = lastonline[index] || user.joindate;
				user.lastonline = timestamp;
				user.lastonlineISO = utils.toISOString(timestamp);
			}
		});
		return userData;
	}
	const set = buildSet();
	const [count, users] = await Promise.all([
		getCount(set),
		getUsersWithFields(set),
	]);

	await render(req, res, {
		users: users.filter(user => user && parseInt(user.uid, 10)),
		page: page,
		pageCount: Math.max(1, Math.ceil(count / resultsPerPage)),
		resultsPerPage: resultsPerPage,
		reverse: reverse,
		sortBy: sortBy,
	});
}

usersController.search = async function (req, res) {
	const sortDirection = req.query.sortDirection || 'desc';
	const reverse = sortDirection === 'desc';
	const page = parseInt(req.query.page, 10) || 1;
	let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
	if (![50, 100, 250, 500].includes(resultsPerPage)) {
		resultsPerPage = 50;
	}

	const searchData = await user.search({
		uid: req.uid,
		query: req.query.query,
		searchBy: req.query.searchBy,
		sortBy: req.query.sortBy,
		sortDirection: sortDirection,
		filters: req.query.filters,
		page: page,
		resultsPerPage: resultsPerPage,
		findUids: async function (query, searchBy, hardCap) {
			if (!query || query.length < 2) {
				return [];
			}
			hardCap = hardCap || resultsPerPage * 10;
			if (!query.endsWith('*')) {
				query += '*';
			}

			const data = await db.getSortedSetScan({
				key: searchBy + ':sorted',
				match: query,
				limit: hardCap,
			});
			return data.map(data => data.split(':').pop());
		},
	});

	const uids = searchData.users.map(user => user && user.uid);
	const userInfo = await user.getUsersFields(uids, ['email', 'flags', 'lastonline', 'joindate']);

	searchData.users.forEach(function (user, index) {
		if (user && userInfo[index]) {
			user.email = userInfo[index].email;
			user.flags = userInfo[index].flags || 0;
			user.lastonlineISO = userInfo[index].lastonlineISO;
			user.joindateISO = userInfo[index].joindateISO;
		}
	});
	searchData.query = validator.escape(String(req.query.query || ''));
	searchData.resultsPerPage = resultsPerPage;
	searchData.sortBy = req.query.sortBy;
	searchData.reverse = reverse;
	await render(req, res, searchData);
};

usersController.registrationQueue = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const itemsPerPage = 20;
	const start = (page - 1) * 20;
	const stop = start + itemsPerPage - 1;

	const data = await utils.promiseParallel({
		registrationQueueCount: db.sortedSetCard('registration:queue'),
		users: user.getRegistrationQueue(start, stop),
		customHeaders: plugins.hooks.fire('filter:admin.registrationQueue.customHeaders', { headers: [] }),
		invites: getInvites(),
	});
	var pageCount = Math.max(1, Math.ceil(data.registrationQueueCount / itemsPerPage));
	data.pagination = pagination.create(page, pageCount);
	data.customHeaders = data.customHeaders.headers;
	res.render('admin/manage/registration', data);
};

async function getInvites() {
	const invitations = await user.getAllInvites();
	const uids = invitations.map(invite => invite.uid);
	let usernames = await user.getUsersFields(uids, ['username']);
	usernames = usernames.map(user => user.username);

	invitations.forEach(function (invites, index) {
		invites.username = usernames[index];
	});

	async function getUsernamesByEmails(emails) {
		const uids = await db.sortedSetScores('email:uid', emails.map(email => String(email).toLowerCase()));
		const usernames = await user.getUsersFields(uids, ['username']);
		return usernames.map(user => user.username);
	}

	usernames = await Promise.all(invitations.map(invites => getUsernamesByEmails(invites.invitations)));

	invitations.forEach(function (invites, index) {
		invites.invitations = invites.invitations.map(function (email, i) {
			return {
				email: email,
				username: usernames[index][i] === '[[global:guest]]' ? '' : usernames[index][i],
			};
		});
	});
	return invitations;
}

async function render(req, res, data) {
	data.pagination = pagination.create(data.page, data.pageCount, req.query);

	const registrationType = meta.config.registrationType;

	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';
	data['sort_' + data.sortBy] = true;
	if (req.query.searchBy) {
		data['searchBy_' + validator.escape(String(req.query.searchBy))] = true;
	}
	const filterBy = Array.isArray(req.query.filters || []) ? (req.query.filters || []) : [req.query.filters];
	filterBy.forEach(function (filter) {
		data['filterBy_' + validator.escape(String(filter))] = true;
	});
	data.userCount = parseInt(await db.getObjectField('global', 'userCount'), 10);
	if (data.adminInviteOnly) {
		data.showInviteButton = await privileges.users.isAdministrator(req.uid);
	} else {
		data.showInviteButton = await privileges.users.hasInvitePrivilege(req.uid);
	}

	res.render('admin/manage/users', data);
}

usersController.getCSV = async function (req, res, next) {
	await events.log({
		type: 'getUsersCSV',
		uid: req.uid,
		ip: req.ip,
	});
	const path = require('path');
	const { baseDir } = require('../../constants').paths;
	res.sendFile('users.csv', {
		root: path.join(baseDir, 'build/export'),
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename=users.csv',
		},
	}, function (err) {
		if (err) {
			if (err.code === 'ENOENT') {
				res.locals.isAPI = false;
				return next();
			}
			return next(err);
		}
	});
};
