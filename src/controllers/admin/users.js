'use strict';

const nconf = require('nconf');

const user = require('../../user');
const meta = require('../../meta');
const db = require('../../database');
const pagination = require('../../pagination');
const events = require('../../events');
const plugins = require('../../plugins');
const utils = require('../../utils');

const usersController = module.exports;

const userFields = ['uid', 'username', 'userslug', 'email', 'postcount', 'joindate', 'banned',
	'reputation', 'picture', 'flags', 'lastonline', 'email:confirmed'];

usersController.search = function (req, res) {
	res.render('admin/manage/users', {
		search_display: '',
		users: [],
	});
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
		return await user.getUsersWithFields(uids, userFields, req.uid);
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
