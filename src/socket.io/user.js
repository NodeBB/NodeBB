'use strict';

const util = require('util');
const winston = require('winston');

const sleep = util.promisify(setTimeout);

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

const SocketUser = module.exports;

require('./user/profile')(SocketUser);
require('./user/status')(SocketUser);
require('./user/picture')(SocketUser);
require('./user/registration')(SocketUser);

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
		await sleep(2500 + ((Math.random() * 500) - 250));
	} catch (err) {
		await logEvent(err.message);
		await sleep(2500 + ((Math.random() * 500) - 250));
		const internalErrors = ['[[error:invalid-email]]'];
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
		plugins.hooks.fire('action:password.reset', { uid: socket.uid }),
	]);

	await events.log({
		type: 'password-reset',
		uid: uid,
		ip: socket.ip,
	});

	const username = await user.getUserField(uid, 'username');
	const now = new Date();
	const parsedDate = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
	emailer.send('reset_notify', uid, {
		username: username,
		date: parsedDate,
		subject: '[[email:reset.notify.subject]]',
	}).catch(err => winston.error(`[emailer.send] ${err.stack}`));
};

SocketUser.isFollowing = async function (socket, data) {
	if (!socket.uid || !data.uid) {
		return false;
	}

	return await user.isFollowing(socket.uid, data.uid);
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
	return await user.getModerationNotes(data.uid, 0, 0);
};

SocketUser.editModerationNote = async function (socket, data) {
	if (!socket.uid || !data || !data.uid || !data.note || !data.id) {
		throw new Error('[[error:invalid-data]]');
	}
	const noteData = {
		note: data.note,
		timestamp: data.id,
	};
	let canEdit = await privileges.users.canEdit(socket.uid, data.uid);
	if (!canEdit) {
		canEdit = await user.isModeratorOfAnyCategory(socket.uid);
	}
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	await user.setModerationNote({ uid: data.uid, noteData });
	return await user.getModerationNotesByIds(data.uid, [data.id]);
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
	return await db.getObjectField(`user:${data.uid}`, 'gdpr_consent');
};

require('../promisify')(SocketUser);
