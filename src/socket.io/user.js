'use strict';

const async = require('async');

const util = require('util');
const sleep = util.promisify(setTimeout);

const api = require('../api');
const user = require('../user');
const topics = require('../topics');
const messaging = require('../messaging');
const plugins = require('../plugins');
const meta = require('../meta');
const events = require('../events');
const emailer = require('../emailer');
const db = require('../database');
const userController = require('../controllers/user');
const privileges = require('../privileges');
const utils = require('../utils');
const flags = require('../flags');
const sockets = require('.');

const SocketUser = module.exports;

require('./user/profile')(SocketUser);
require('./user/search')(SocketUser);
require('./user/status')(SocketUser);
require('./user/picture')(SocketUser);
require('./user/ban')(SocketUser);
require('./user/registration')(SocketUser);

SocketUser.exists = async function (socket, data) {
	if (!data || !data.username) {
		throw new Error('[[error:invalid-data]]');
	}
	return await meta.userOrGroupExists(data.username);
};

SocketUser.deleteAccount = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}
	const hasPassword = await user.hasPassword(socket.uid);
	if (hasPassword) {
		const ok = await user.isPasswordCorrect(socket.uid, data.password, socket.ip);
		if (!ok) {
			throw new Error('[[error:invalid-password]]');
		}
	}
	const isAdmin = await user.isAdministrator(socket.uid);
	if (isAdmin) {
		throw new Error('[[error:cant-delete-admin]]');
	}
	if (meta.config.allowAccountDelete !== 1) {
		throw new Error('[[error:no-privileges]]');
	}

	await flags.resolveFlag('user', socket.uid, socket.uid);
	const userData = await user.deleteAccount(socket.uid);

	require('./index').server.sockets.emit('event:user_status_change', { uid: socket.uid, status: 'offline' });

	await events.log({
		type: 'user-delete',
		uid: socket.uid,
		targetUid: socket.uid,
		ip: socket.ip,
		username: userData.username,
		email: userData.email,
	});
};

SocketUser.emailExists = async function (socket, data) {
	if (!data || !data.email) {
		throw new Error('[[error:invalid-data]]');
	}
	return await user.email.exists(data.email);
};

SocketUser.emailConfirm = async function (socket) {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!meta.config.requireEmailConfirmation) {
		throw new Error('[[error:email-confirmations-are-disabled]]');
	}

	return await user.email.sendValidationEmail(socket.uid);
};


// Password Reset
SocketUser.reset = {};

SocketUser.reset.send = async function (socket, email) {
	if (!email) {
		throw new Error('[[error:invalid-data]]');
	}

	if (meta.config['password:disableEdit']) {
		throw new Error('[[error:no-privileges]]');
	}
	async function logEvent(text) {
		await events.log({
			type: 'password-reset',
			text: text,
			ip: socket.ip,
			uid: socket.uid,
			email: email,
		});
	}
	try {
		await user.reset.send(email);
		await logEvent('[[success:success]]');
		await sleep(2500);
	} catch (err) {
		await logEvent(err.message);
		const internalErrors = ['[[error:invalid-email]]', '[[error:reset-rate-limited]]'];
		if (!internalErrors.includes(err.message)) {
			throw err;
		}
	}
};

SocketUser.reset.commit = async function (socket, data) {
	if (!data || !data.code || !data.password) {
		throw new Error('[[error:invalid-data]]');
	}
	const [uid] = await Promise.all([
		db.getObjectField('reset:uid', data.code),
		user.reset.commit(data.code, data.password),
		plugins.fireHook('action:password.reset', { uid: socket.uid }),
	]);

	await events.log({
		type: 'password-reset',
		uid: uid,
		ip: socket.ip,
	});

	const username = await user.getUserField(uid, 'username');
	const now = new Date();
	const parsedDate = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
	emailer.send('reset_notify', uid, {
		username: username,
		date: parsedDate,
		subject: '[[email:reset.notify.subject]]',
	});
};

SocketUser.isFollowing = async function (socket, data) {
	if (!socket.uid || !data.uid) {
		return false;
	}

	return await user.isFollowing(socket.uid, data.uid);
};

SocketUser.follow = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/users/follow');
	await api.users.follow(socket, data);
};

SocketUser.unfollow = async function (socket, data) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/users/unfollow');
	await api.users.unfollow(socket, data);
};

SocketUser.saveSettings = async function (socket, data) {
	if (!socket.uid || !data || !data.settings) {
		throw new Error('[[error:invalid-data]]');
	}
	const canEdit = await privileges.users.canEdit(socket.uid, data.uid);
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}
	return await user.saveSettings(data.uid, data.settings);
};

SocketUser.setTopicSort = async function (socket, sort) {
	await user.setSetting(socket.uid, 'topicPostSort', sort);
};

SocketUser.setCategorySort = async function (socket, sort) {
	await user.setSetting(socket.uid, 'categoryTopicSort', sort);
};

SocketUser.getUnreadCount = async function (socket) {
	if (!socket.uid) {
		return 0;
	}
	return await topics.getTotalUnread(socket.uid, '');
};

SocketUser.getUnreadChatCount = async function (socket) {
	if (!socket.uid) {
		return 0;
	}
	return await messaging.getUnreadCount(socket.uid);
};

SocketUser.getUnreadCounts = async function (socket) {
	if (!socket.uid) {
		return {};
	}
	const results = await utils.promiseParallel({
		unreadCounts: topics.getUnreadTids({ uid: socket.uid, count: true }),
		unreadChatCount: messaging.getUnreadCount(socket.uid),
		unreadNotificationCount: user.notifications.getUnreadCount(socket.uid),
	});
	results.unreadTopicCount = results.unreadCounts[''];
	results.unreadNewTopicCount = results.unreadCounts.new;
	results.unreadWatchedTopicCount = results.unreadCounts.watched;
	results.unreadUnrepliedTopicCount = results.unreadCounts.unreplied;
	return results;
};

SocketUser.invite = async function (socket, email) {
	if (!email || !socket.uid) {
		throw new Error('[[error:invalid-data]]');
	}

	const registrationType = meta.config.registrationType;
	if (registrationType !== 'invite-only' && registrationType !== 'admin-invite-only') {
		throw new Error('[[error:forum-not-invite-only]]');
	}

	const isAdmin = await user.isAdministrator(socket.uid);
	if (registrationType === 'admin-invite-only' && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}

	const max = meta.config.maximumInvites;
	email = email.split(',').map(email => email.trim()).filter(Boolean);

	await async.eachSeries(email, async function (email) {
		let invites = 0;
		if (max) {
			invites = await user.getInvitesNumber(socket.uid);
		}
		if (!isAdmin && max && invites >= max) {
			throw new Error('[[error:invite-maximum-met, ' + invites + ', ' + max + ']]');
		}

		await user.sendInvitationEmail(socket.uid, email);
	});
};

SocketUser.getUserByUID = async function (socket, uid) {
	return await userController.getUserDataByField(socket.uid, 'uid', uid);
};

SocketUser.getUserByUsername = async function (socket, username) {
	return await userController.getUserDataByField(socket.uid, 'username', username);
};

SocketUser.getUserByEmail = async function (socket, email) {
	return await userController.getUserDataByField(socket.uid, 'email', email);
};

SocketUser.setModerationNote = async function (socket, data) {
	if (!socket.uid || !data || !data.uid || !data.note) {
		throw new Error('[[error:invalid-data]]');
	}
	const noteData = {
		uid: socket.uid,
		note: data.note,
		timestamp: Date.now(),
	};
	let canEdit = await privileges.users.canEdit(socket.uid, data.uid);
	if (!canEdit) {
		canEdit = await user.isModeratorOfAnyCategory(socket.uid);
	}
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	await user.appendModerationNote({ uid: data.uid, noteData });
};

SocketUser.deleteUpload = async function (socket, data) {
	if (!data || !data.name || !data.uid) {
		throw new Error('[[error:invalid-data]]');
	}
	await user.deleteUpload(socket.uid, data.uid, data.name);
};

SocketUser.gdpr = {};

SocketUser.gdpr.consent = async function (socket) {
	await user.setUserField(socket.uid, 'gdpr_consent', 1);
};

SocketUser.gdpr.check = async function (socket, data) {
	const isAdmin = await user.isAdministrator(socket.uid);
	if (!isAdmin) {
		data.uid = socket.uid;
	}
	return await db.getObjectField('user:' + data.uid, 'gdpr_consent');
};

require('../promisify')(SocketUser);
