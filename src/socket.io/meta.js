'use strict';

const os = require('os');

const user = require('../user');
const meta = require('../meta');
const topics = require('../topics');
const privileges = require('../privileges');
const messaging = require('../messaging');

const SocketMeta = module.exports;
SocketMeta.rooms = {};

SocketMeta.reconnected = async function (socket) {
	if (socket.uid > 0) {
		await Promise.all([
			topics.pushUnreadCount(socket.uid),
			user.notifications.pushCount(socket.uid),
			messaging.pushUnreadCount(socket.uid),
		]);
	}
	return {
		'cache-buster': meta.config['cache-buster'],
		hostname: os.hostname(),
	};
};

/* Rooms */

SocketMeta.rooms.enter = async function (socket, data) {
	if (!socket.uid) {
		return;
	}

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	if (data.enter) {
		data.enter = data.enter.toString();
	}

	if (data.enter && data.enter.startsWith('uid_') && data.enter !== `uid_${socket.uid}`) {
		throw new Error('[[error:not-allowed]]');
	}

	if (data.enter && data.enter.startsWith('chat_')) {
		throw new Error('[[error:not-allowed]]');
	}

	if (data.enter && data.enter.startsWith('topic_')) {
		const tid = data.enter.split('_').pop();
		if (!await privileges.topics.can('topics:read', tid, socket.uid)) {
			throw new Error('[[error:no-privileges]]');
		}
	}

	if (data.enter && data.enter.startsWith('category_')) {
		const cid = data.enter.split('_').pop();
		if (!await privileges.categories.can('read', cid, socket.uid)) {
			throw new Error('[[error:no-privileges]]');
		}
	}

	leaveCurrentRoom(socket);

	if (data.enter) {
		socket.join(data.enter);
		socket.currentRoom = data.enter;
	}
};

SocketMeta.rooms.leaveCurrent = async function (socket) {
	if (!socket.uid || !socket.currentRoom) {
		return;
	}
	leaveCurrentRoom(socket);
};

function leaveCurrentRoom(socket) {
	if (socket.currentRoom) {
		socket.leave(socket.currentRoom);
		socket.currentRoom = '';
	}
}

require('../promisify')(SocketMeta);
