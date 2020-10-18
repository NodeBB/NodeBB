'use strict';

const async = require('async');
const winston = require('winston');

const db = require('../../database');
const api = require('../../api');
const groups = require('../../groups');
const user = require('../../user');
const events = require('../../events');
const meta = require('../../meta');
const plugins = require('../../plugins');
const translator = require('../../translator');
const flags = require('../../flags');
const sockets = require('..');

const User = module.exports;

User.makeAdmins = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	const userData = await user.getUsersFields(uids, ['banned']);
	userData.forEach((userData) => {
		if (userData && userData.banned) {
			throw new Error('[[error:cant-make-banned-users-admin]]');
		}
	});
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

User.createUser = async function (socket, userData) {
	sockets.warnDeprecated(socket, 'POST /api/v3/users');
	return await api.users.create(socket, userData);
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

	uids = uids.filter(uid => parseInt(uid, 10));
	await db.setObjectField(uids.map(uid => 'user:' + uid), 'email:confirmed', 1);
	for (const uid of uids) {
		await groups.join('verified-users', uid);
		await groups.leave('unverified-users', uid);
	}
};

User.sendValidationEmail = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	if (!meta.config.requireEmailConfirmation) {
		throw new Error('[[error:email-confirmations-are-disabled]]');
	}

	await async.eachLimit(uids, 50, async function (uid) {
		await user.email.sendValidationEmail(uid, { force: true });
	});
};

User.sendPasswordResetEmail = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	await Promise.all(uids.map(async function (uid) {
		const userData = await user.getUserFields(uid, ['email', 'username']);
		if (!userData.email) {
			throw new Error('[[error:user-doesnt-have-email, ' + userData.username + ']]');
		}
		await user.reset.send(userData.email);
	}));
};

User.forcePasswordReset = async function (socket, uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	await db.setObjectField(uids.map(uid => 'user:' + uid), 'passwordExpiry', Date.now());
	await user.auth.revokeAllSessions(uids);
};

User.deleteUsers = async function (socket, uids) {
	await canDeleteUids(uids);
	deleteUsers(socket, uids, async function (uid) {
		return await user.deleteAccount(uid);
	});
};

User.deleteUsersContent = async function (socket, uids) {
	await canDeleteUids(uids);
	await Promise.all(uids.map(async (uid) => {
		await user.deleteContent(socket.uid, uid);
	}));
};

User.deleteUsersAndContent = async function (socket, uids) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/users or DELETE /api/v3/users/:uid');
	await api.users.deleteMany(socket, { uids });
};

async function canDeleteUids(uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	const isMembers = await groups.isMembers(uids, 'administrators');
	if (isMembers.includes(true)) {
		throw new Error('[[error:cant-delete-other-admins]]');
	}
}

async function deleteUsers(socket, uids, method) {
	async function doDelete(uid) {
		await flags.resolveFlag('user', uid, socket.uid);
		const userData = await method(uid);
		await events.log({
			type: 'user-delete',
			uid: socket.uid,
			targetUid: uid,
			ip: socket.ip,
			username: userData.username,
			email: userData.email,
		});
		plugins.fireHook('action:user.delete', {
			callerUid: socket.uid,
			uid: uid,
			ip: socket.ip,
			user: userData,
		});
	}
	try {
		await Promise.all(uids.map(uid => doDelete(uid)));
	} catch (err) {
		winston.error(err.stack);
	}
}

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
