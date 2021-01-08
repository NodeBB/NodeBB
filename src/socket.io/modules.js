'use strict';

const validator = require('validator');

const db = require('../database');
const meta = require('../meta');
const notifications = require('../notifications');
const plugins = require('../plugins');
const Messaging = require('../messaging');
const utils = require('../utils');
const server = require('./index');
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
		db.isSortedSetMember('uid:' + socket.uid + ':chat:room:' + roomId + ':mids', data.mid),
		Messaging.isUserInRoom(socket.uid, roomId),
	]);

	if (!isAdmin && (!inRoom || !hasMessage)) {
		throw new Error('[[error:not-allowed]]');
	}

	return await Messaging.getMessageField(data.mid, 'content');
};

SocketModules.chats.isDnD = async function (socket, uid) {
	const status = await db.getObjectField('user:' + uid, 'status');
	return status === 'dnd';
};

SocketModules.chats.newRoom = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	if (rateLimitExceeded(socket)) {
		throw new Error('[[error:too-many-messages]]');
	}

	const canChat = await privileges.global.can('chat', socket.uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}
	await Messaging.canMessageUser(socket.uid, data.touid);
	return await Messaging.newRoom(socket.uid, [data.touid]);
};

SocketModules.chats.send = async function (socket, data) {
	if (!data || !data.roomId || !socket.uid) {
		throw new Error('[[error:invalid-data]]');
	}

	if (rateLimitExceeded(socket)) {
		throw new Error('[[error:too-many-messages]]');
	}
	const canChat = await privileges.global.can('chat', socket.uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}
	const results = await plugins.hooks.fire('filter:messaging.send', {
		data: data,
		uid: socket.uid,
	});
	data = results.data;

	await Messaging.canMessageRoom(socket.uid, data.roomId);
	const message = await Messaging.sendMessage({
		uid: socket.uid,
		roomId: data.roomId,
		content: data.message,
		timestamp: Date.now(),
		ip: socket.ip,
	});
	Messaging.notifyUsersInRoom(socket.uid, data.roomId, message);
	user.updateOnlineUsers(socket.uid);
	return message;
};

function rateLimitExceeded(socket) {
	const now = Date.now();
	socket.lastChatMessageTime = socket.lastChatMessageTime || 0;
	if (now - socket.lastChatMessageTime < meta.config.chatMessageDelay) {
		return true;
	}
	socket.lastChatMessageTime = now;
	return false;
}

SocketModules.chats.loadRoom = async function (socket, data) {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	return await Messaging.loadRoom(socket.uid, data);
};

SocketModules.chats.getUsersInRoom = async function (socket, data) {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const [isUserInRoom, isOwner, userData] = await Promise.all([
		Messaging.isUserInRoom(socket.uid, data.roomId),
		Messaging.isRoomOwner(socket.uid, data.roomId),
		Messaging.getUsersInRoom(data.roomId, 0, -1),
	]);
	if (!isUserInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	userData.forEach((user) => {
		user.canKick = (parseInt(user.uid, 10) !== parseInt(socket.uid, 10)) && isOwner;
	});
	return userData;
};

SocketModules.chats.addUserToRoom = async function (socket, data) {
	if (!data || !data.roomId || !data.username) {
		throw new Error('[[error:invalid-data]]');
	}

	const canChat = await privileges.global.can('chat', socket.uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}

	const userCount = await Messaging.getUserCountInRoom(data.roomId);
	const maxUsers = meta.config.maximumUsersInChatRoom;
	if (maxUsers && userCount >= maxUsers) {
		throw new Error('[[error:cant-add-more-users-to-chat-room]]');
	}

	const uid = await user.getUidByUsername(data.username);
	if (!uid) {
		throw new Error('[[error:no-user]]');
	}
	if (socket.uid === parseInt(uid, 10)) {
		throw new Error('[[error:cant-chat-with-yourself]]');
	}
	const [settings, isAdminOrGlobalMod, isFollowing] = await Promise.all([
		user.getSettings(uid),
		user.isAdminOrGlobalMod(socket.uid),
		user.isFollowing(uid, socket.uid),
	]);

	if (settings.restrictChat && !isAdminOrGlobalMod && !isFollowing) {
		throw new Error('[[error:chat-restricted]]');
	}

	await Messaging.addUsersToRoom(socket.uid, [uid], data.roomId);
};

SocketModules.chats.removeUserFromRoom = async function (socket, data) {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const exists = await user.exists(data.uid);
	if (!exists) {
		throw new Error('[[error:no-user]]');
	}

	await Messaging.removeUsersFromRoom(socket.uid, [data.uid], data.roomId);
};

SocketModules.chats.leave = async function (socket, roomid) {
	if (!socket.uid || !roomid) {
		throw new Error('[[error:invalid-data]]');
	}

	await Messaging.leaveRoom([socket.uid], roomid);
};

SocketModules.chats.edit = async function (socket, data) {
	if (!data || !data.roomId || !data.message) {
		throw new Error('[[error:invalid-data]]');
	}
	await Messaging.canEdit(data.mid, socket.uid);
	await Messaging.editMessage(socket.uid, data.mid, data.roomId, data.message);
};

SocketModules.chats.delete = async function (socket, data) {
	if (!data || !data.roomId || !data.messageId) {
		throw new Error('[[error:invalid-data]]');
	}
	await Messaging.canDelete(data.messageId, socket.uid);
	await Messaging.deleteMessage(data.messageId, socket.uid);
};

SocketModules.chats.restore = async function (socket, data) {
	if (!data || !data.roomId || !data.messageId) {
		throw new Error('[[error:invalid-data]]');
	}
	await Messaging.canDelete(data.messageId, socket.uid);
	await Messaging.restoreMessage(data.messageId, socket.uid);
};

SocketModules.chats.canMessage = async function (socket, roomId) {
	await Messaging.canMessageRoom(socket.uid, roomId);
};

SocketModules.chats.markRead = async function (socket, roomId) {
	if (!socket.uid || !roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const [uidsInRoom] = await Promise.all([
		Messaging.getUidsInRoom(roomId, 0, -1),
		Messaging.markRead(socket.uid, roomId),
	]);

	Messaging.pushUnreadCount(socket.uid);
	server.in('uid_' + socket.uid).emit('event:chats.markedAsRead', { roomId: roomId });

	if (!uidsInRoom.includes(String(socket.uid))) {
		return;
	}

	// Mark notification read
	const nids = uidsInRoom.filter(uid => parseInt(uid, 10) !== socket.uid)
		.map(uid => 'chat_' + uid + '_' + roomId);

	await notifications.markReadMultiple(nids, socket.uid);
	await user.notifications.pushCount(socket.uid);
};

SocketModules.chats.markAllRead = async function (socket) {
	await Messaging.markAllRead(socket.uid);
	Messaging.pushUnreadCount(socket.uid);
};

SocketModules.chats.renameRoom = async function (socket, data) {
	if (!data || !data.roomId || !data.newName) {
		throw new Error('[[error:invalid-data]]');
	}
	await Messaging.renameRoom(socket.uid, data.roomId, data.newName);
	const uids = await Messaging.getUidsInRoom(data.roomId, 0, -1);
	const eventData = { roomId: data.roomId, newName: validator.escape(String(data.newName)) };
	uids.forEach(function (uid) {
		server.in('uid_' + uid).emit('event:chats.roomRename', eventData);
	});
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

SocketModules.chats.getMessages = async function (socket, data) {
	if (!socket.uid || !data || !data.uid || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	return await Messaging.getMessages({
		callerUid: socket.uid,
		uid: data.uid,
		roomId: data.roomId,
		start: parseInt(data.start, 10) || 0,
		count: 50,
	});
};

SocketModules.chats.getIP = async function (socket, mid) {
	const allowed = await privileges.global.can('view:users:info', socket.uid);
	if (!allowed) {
		throw new Error('[[error:no-privilege]]');
	}
	return await Messaging.getMessageField(mid, 'ip');
};

require('../promisify')(SocketModules);
