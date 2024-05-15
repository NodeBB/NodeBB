'use strict';

const async = require('async');
const winston = require('winston');

const db = require('../../database');
const groups = require('../../groups');
const user = require('../../user');
const events = require('../../events');
const translator = require('../../translator');
const utils = require('../../utils');
const sockets = require('..');

const User = module.exports;

User.makeAdmins = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	const isMembersOfBanned = await groups.isMembers(uids, groups.BANNED_USERS);
	if (isMembersOfBanned.includes(true)) {
		throw new Error('[[error:cant-make-banned-users-admin]]');
	}
	for (const uid of uids) {
		/* eslint-disable no-await-in-loop */
		await groups.join('administrators', uid);
		await events.log({
			type: 'user-makeAdmin',
			uid: socket.uid,
			targetUid: uid,
			ip: socket.ip,
		});
	}
};

User.removeAdmins = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	for (const uid of uids) {
		/* eslint-disable no-await-in-loop */
		const count = await groups.getMemberCount('administrators');
		if (count === 1) {
			throw new Error('[[error:cant-remove-last-admin]]');
		}
		await groups.leave('administrators', uid);
		await events.log({
			type: 'user-removeAdmin',
			uid: socket.uid,
			targetUid: uid,
			ip: socket.ip,
		});
	}
};

User.resetLockouts = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	await Promise.all(uids.map(uid => user.auth.resetLockout(uid)));
};

User.validateEmail = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	for (const uid of uids) {
		const email = await user.email.getEmailForValidation(uid);
		if (email) {
			await user.setUserField(uid, 'email', email);
		}
		await user.email.confirmByUid(uid, socket.uid);
	}
};

User.sendValidationEmail = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	const failed = [];
	let errorLogged = false;
	await async.eachLimit(uids, 50, async (uid) => {
		const email = await user.email.getEmailForValidation(uid);
		await user.email.sendValidationEmail(uid, {
			force: true,
			email: email,
		}).catch((err) => {
			if (!errorLogged) {
				winston.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`);
				errorLogged = true;
			}

			failed.push(uid);
		});
	});

	if (failed.length) {
		throw Error(`Email sending failed for the following uids, check server logs for more info: ${failed.join(',')}`);
	}
};

User.sendPasswordResetEmail = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	await Promise.all(uids.map(async (uid) => {
		const userData = await user.getUserFields(uid, ['email', 'username']);
		if (!userData.email) {
			throw new Error(`[[error:user-doesnt-have-email, ${userData.username}]]`);
		}
		await user.reset.send(userData.email);
	}));
};

User.forcePasswordReset = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	await db.setObjectField(uids.map(uid => `user:${uid}`), 'passwordExpiry', Date.now());
	await user.auth.revokeAllSessions(uids);
	uids.forEach(uid => sockets.in(`uid_${uid}`).emit('event:logout'));
};

User.restartJobs = async function () {
	user.startJobs();
};

User.loadGroups = async function (socket, uids) {
	const [userData, groupData] = await Promise.all([
		user.getUsersData(uids),
		groups.getUserGroupsFromSet('groups:createtime', uids),
	]);
	userData.forEach((data, index) => {
		data.groups = groupData[index].filter(group => !groups.isPrivilegeGroup(group.name));
		data.groups.forEach((group) => {
			group.nameEscaped = translator.escape(group.displayName);
		});
	});
	return { users: userData };
};

User.setReputation = async function (socket, data) {
	if (!data || !Array.isArray(data.uids) || !utils.isNumber(data.value)) {
		throw new Error('[[error:invalid-data]]');
	}

	await Promise.all([
		db.setObjectBulk(
			data.uids.map(uid => ([`user:${uid}`, { reputation: parseInt(data.value, 10) }]))
		),
		db.sortedSetAddBulk(
			data.uids.map(uid => (['users:reputation', data.value, uid]))
		),
	]);
};

User.exportUsersCSV = async function (socket, data) {
	await events.log({
		type: 'exportUsersCSV',
		uid: socket.uid,
		ip: socket.ip,
	});
	setTimeout(async () => {
		try {
			await user.exportUsersCSV(data.fields);
			if (socket.emit) {
				socket.emit('event:export-users-csv');
			}
			const notifications = require('../../notifications');
			const n = await notifications.create({
				bodyShort: '[[notifications:users-csv-exported]]',
				path: '/api/admin/users/csv',
				nid: 'users:csv:export',
				from: socket.uid,
			});
			await notifications.push(n, [socket.uid]);
		} catch (err) {
			winston.error(err.stack);
		}
	}, 0);
};
