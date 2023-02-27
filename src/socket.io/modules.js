'use strict';

const db = require('../database');
const Messaging = require('../messaging');
const utils = require('../utils');
const user = require('../user');
const privileges = require('../privileges');

const SocketModules = module.exports;

SocketModules.chats = {};
SocketModules.settings = {};

/* Chat */

SocketModules.chats.getRaw = async function (socket, data) {
	if (!data || !data.hasOwnProperty('mid')) {
		throw new Error('[[error:invalid-data]]');
	}
	const roomId = await Messaging.getMessageField(data.mid, 'roomId');
	const [isAdmin, hasMessage, inRoom] = await Promise.all([
		user.isAdministrator(socket.uid),
		db.isSortedSetMember(`uid:${socket.uid}:chat:room:${roomId}:mids`, data.mid),
		Messaging.isUserInRoom(socket.uid, roomId),
	]);

	if (!isAdmin && (!inRoom || !hasMessage)) {
		throw new Error('[[error:not-allowed]]');
	}

	return await Messaging.getMessageField(data.mid, 'content');
};

SocketModules.chats.isDnD = async function (socket, uid) {
	const status = await db.getObjectField(`user:${uid}`, 'status');
	return status === 'dnd';
};

SocketModules.chats.canMessage = async function (socket, roomId) {
	await Messaging.canMessageRoom(socket.uid, roomId);
};

SocketModules.chats.markAllRead = async function (socket) {
	// no v3 method ?
	await Messaging.markAllRead(socket.uid);
	Messaging.pushUnreadCount(socket.uid);
};

SocketModules.chats.getRecentChats = async function (socket, data) {
	if (!data || !utils.isNumber(data.after) || !utils.isNumber(data.uid)) {
		throw new Error('[[error:invalid-data]]');
	}
	const start = parseInt(data.after, 10);
	const stop = start + 9;
	return await Messaging.getRecentChats(socket.uid, data.uid, start, stop);
};

SocketModules.chats.hasPrivateChat = async function (socket, uid) {
	if (socket.uid <= 0 || uid <= 0) {
		throw new Error('[[error:invalid-data]]');
	}
	return await Messaging.hasPrivateChat(socket.uid, uid);
};

SocketModules.chats.getIP = async function (socket, mid) {
	const allowed = await privileges.global.can('view:users:info', socket.uid);
	if (!allowed) {
		throw new Error('[[error:no-privilege]]');
	}
	return await Messaging.getMessageField(mid, 'ip');
};

require('../promisify')(SocketModules);
