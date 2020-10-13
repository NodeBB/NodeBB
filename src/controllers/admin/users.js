'use strict';

const nconf = require('nconf');
const validator = require('validator');

const user = require('../../user');
const meta = require('../../meta');
const db = require('../../database');
const pagination = require('../../pagination');
const events = require('../../events');
const plugins = require('../../plugins');
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
		await newGet(req, res);
	}
};

async function newGet(req, res) {
	const sortDirection = req.query.sortDirection || 'desc';
	const reverse = sortDirection === 'desc';

	const page = parseInt(req.query.page, 10) || 1;
	let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
	if (![50, 100, 250, 500].includes(resultsPerPage)) {
		resultsPerPage = 50;
	}
	const sortBy = validator.escape(req.query.sortBy || 'joindate');
	const filterBy = Array.isArray(req.query.filter) ? req.query.filter : [req.query.filter];
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	function buildSet() {
		const sortToSet = {
			postcount: 'users:postcount',
			reputation: 'users:reputation',
			joindate: 'users:joindate',
			online: 'users:online',
			flags: 'users:flags',
		};

		const set = [sortToSet[sortBy] || 'users:joindate'];
		if (filterBy.includes('notvalidated')) {
			set.push('users:notvalidated');
		}
		if (filterBy.includes('banned')) {
			set.push('users:banned');
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
		console.log('get uids', set);
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
		const [isAdmin, userData] = await Promise.all([
			user.isAdministrator(uids),
			user.getUsersWithFields(uids, userFields, req.uid),
		]);
		userData.forEach((user, index) => {
			if (user) {
				user.administrator = isAdmin[index];
			}
		});
		return userData;
	}
	const set = buildSet();
	const [count, users] = await Promise.all([
		getCount(set),
		getUsersWithFields(set),
	]);

	const data = {
		users: users.filter(user => user && parseInt(user.uid, 10)),
		page: page,
		pageCount: Math.max(1, Math.ceil(count / resultsPerPage)),
		resultsPerPage: resultsPerPage,
		reverse: reverse,
		sortBy: sortBy,
	};
	data['sort_' + sortBy] = true;
	// data[section] = true;
	render(req, res, data);
}

usersController.search = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
	if (![50, 100, 250, 500].includes(resultsPerPage)) {
		resultsPerPage = 50;
	}
	const searchData = await user.search({
		uid: req.uid,
		query: req.query.query,
		searchBy: req.query.searchBy,
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
	searchData.uidQuery = req.query.searchBy === 'uid' ? searchData.query : '';
	searchData.usernameQuery = req.query.searchBy === 'username' ? searchData.query : '';
	searchData.emailQuery = req.query.searchBy === 'email' ? searchData.query : '';
	searchData.ipQuery = req.query.searchBy === 'uid' ? searchData.query : '';
	searchData.resultsPerPage = resultsPerPage;
	searchData.pagination = pagination.create(page, searchData.pageCount, req.query);
	searchData.search_display = '';
	res.render('admin/manage/users', searchData);
};

usersController.sortByJoinDate = async function (req, res) {
	await getUsers('users:joindate', 'latest', undefined, undefined, req, res);
};

usersController.notValidated = async function (req, res) {
	await getUsers('users:notvalidated', 'notvalidated', undefined, undefined, req, res);
};

usersController.noPosts = async function (req, res) {
	await getUsers('users:postcount', 'noposts', '-inf', 0, req, res);
};

usersController.topPosters = async function (req, res) {
	await getUsers('users:postcount', 'topposts', 0, '+inf', req, res);
};

usersController.mostReputaion = async function (req, res) {
	await getUsers('users:reputation', 'mostreputation', 0, '+inf', req, res);
};

usersController.flagged = async function (req, res) {
	await getUsers('users:flags', 'mostflags', 1, '+inf', req, res);
};

usersController.inactive = async function (req, res) {
	const timeRange = 1000 * 60 * 60 * 24 * 30 * (parseInt(req.query.months, 10) || 3);
	const cutoff = Date.now() - timeRange;
	await getUsers('users:online', 'inactive', '-inf', cutoff, req, res);
};

usersController.banned = async function (req, res) {
	await getUsers('users:banned', 'banned', undefined, undefined, req, res);
};

usersController.registrationQueue = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const itemsPerPage = 20;
	const start = (page - 1) * 20;
	const stop = start + itemsPerPage - 1;

	const data = await utils.promiseParallel({
		registrationQueueCount: db.sortedSetCard('registration:queue'),
		users: user.getRegistrationQueue(start, stop),
		customHeaders: plugins.fireHook('filter:admin.registrationQueue.customHeaders', { headers: [] }),
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
		const uids = await db.sortedSetScore('email:uid', emails.map(email => String(email).toLowerCase()));
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

async function getUsers(set, section, min, max, req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	let resultsPerPage = parseInt(req.query.resultsPerPage, 10) || 50;
	if (![50, 100, 250, 500].includes(resultsPerPage)) {
		resultsPerPage = 50;
	}
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;
	const byScore = min !== undefined && max !== undefined;

	async function getCount() {
		if (byScore) {
			return await db.sortedSetCount(set, min, max);
		} else if (set === 'users:banned' || set === 'users:notvalidated') {
			return await db.sortedSetCard(set);
		}
		return await db.getObjectField('global', 'userCount');
	}

	async function getUsersWithFields() {
		let uids;
		if (byScore) {
			uids = await db.getSortedSetRevRangeByScore(set, start, resultsPerPage, max, min);
		} else {
			uids = await user.getUidsFromSet(set, start, stop);
		}
		const [isAdmin, userData] = await Promise.all([
			user.isAdministrator(uids),
			user.getUsersWithFields(uids, userFields, req.uid),
		]);
		userData.forEach((user, index) => {
			if (user) {
				user.administrator = isAdmin[index];
			}
		});
		return userData;
	}

	const [count, users] = await Promise.all([
		getCount(),
		getUsersWithFields(),
	]);

	const data = {
		users: users.filter(user => user && parseInt(user.uid, 10)),
		page: page,
		pageCount: Math.max(1, Math.ceil(count / resultsPerPage)),
		resultsPerPage: resultsPerPage,
	};
	data[section] = true;
	render(req, res, data);
}

function render(req, res, data) {
	data.search_display = 'hidden';
	data.pagination = pagination.create(data.page, data.pageCount, req.query);
	data.requireEmailConfirmation = meta.config.requireEmailConfirmation;

	var registrationType = meta.config.registrationType;

	data.inviteOnly = registrationType === 'invite-only' || registrationType === 'admin-invite-only';
	data.adminInviteOnly = registrationType === 'admin-invite-only';

	res.render('admin/manage/users', data);
}

usersController.getCSV = async function (req, res) {
	var referer = req.headers.referer;

	if (!referer || !referer.replace(nconf.get('url'), '').startsWith('/admin/manage/users')) {
		return res.status(403).send('[[error:invalid-origin]]');
	}
	events.log({
		type: 'getUsersCSV',
		uid: req.uid,
		ip: req.ip,
	});
	const data = await user.getUsersCSV();
	res.attachment('users.csv');
	res.setHeader('Content-Type', 'text/csv');
	res.end(data);
};
