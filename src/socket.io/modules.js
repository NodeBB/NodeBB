'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const Messaging = require('../messaging');
const utils = require('../utils');
const user = require('../user');
const plugins = require('../plugins');
const privileges = require('../privileges');
const groups = require('../groups');

const api = require('../api');
const sockets = require('.');

const SocketModules = module.exports;

SocketModules.chats = {};
SocketModules.settings = {};

/* Chat */

SocketModules.chats.getRaw = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId/messages/:mid/raw');

	if (!data || !data.hasOwnProperty('mid')) {
		throw new Error('[[error:invalid-data]]');
	}
	const roomId = await Messaging.getMessageField(data.mid, 'roomId');

	const { content } = await api.chats.getRawMessage(socket, {
		mid: data.mid,
		roomId,
	});

	return content;
};

SocketModules.chats.isDnD = async function (socket, uid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/users/:uid/status OR HEAD /api/v3/users/:uid/status/:status');

	const { status } = await api.users.getStatus(socket, { uid });
	return status === 'dnd';
};

SocketModules.chats.canMessage = async function (socket, roomId) {
	sockets.warnDeprecated(socket);

	await Messaging.canMessageRoom(socket.uid, roomId);
};

SocketModules.chats.markAllRead = async function (socket) {
	sockets.warnDeprecated(socket);

	await Messaging.markAllRead(socket.uid);
	Messaging.pushUnreadCount(socket.uid);
};

SocketModules.chats.getRecentChats = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/chats');

	if (!data || !utils.isNumber(data.after) || !utils.isNumber(data.uid)) {
		throw new Error('[[error:invalid-data]]');
	}
	const start = parseInt(data.after, 10);
	const stop = start + 9;
	const { uid } = data;

	return api.chats.list(socket, { uid, start, stop });
};

SocketModules.chats.hasPrivateChat = async function (socket, uid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/users/:uid/chat');

	if (socket.uid <= 0 || uid <= 0) {
		throw new Error('[[error:invalid-data]]');
	}

	// despite the `has` prefix, this method actually did return the roomId.
	const { roomId } = await api.users.getPrivateRoomId(socket, { uid });
	return roomId;
};

SocketModules.chats.getIP = async function (socket, mid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId/messages/:mid/ip');

	const { ip } = await api.chats.getIpAddress(socket, { mid });
	return ip;
};

SocketModules.chats.getUnreadCount = async function (socket) {
	return await Messaging.getUnreadCount(socket.uid);
};

SocketModules.chats.enter = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'join');
};

SocketModules.chats.leave = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'leave');
};

SocketModules.chats.enterPublic = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'join', 'chat_room_public');
};

SocketModules.chats.leavePublic = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'leave', 'chat_room_public');
};

async function joinLeave(socket, roomIds, method, prefix = 'chat_room') {
	if (!(socket.uid > 0)) {
		throw new Error('[[error:not-allowed]]');
	}
	if (!Array.isArray(roomIds)) {
		roomIds = [roomIds];
	}
	if (roomIds.length) {
		const [isAdmin, inRooms, roomData] = await Promise.all([
			user.isAdministrator(socket.uid),
			Messaging.isUserInRoom(socket.uid, roomIds),
			Messaging.getRoomsData(roomIds, ['public', 'groups']),
		]);

		await Promise.all(roomIds.map(async (roomId, idx) => {
			const isPublic = roomData[idx] && roomData[idx].public;
			const roomGroups = roomData[idx] && roomData[idx].groups;

			if (isAdmin ||
				(
					inRooms[idx] &&
					(!isPublic || !roomGroups.length || await groups.isMemberOfAny(socket.uid, roomGroups))
				)
			) {
				socket[method](`${prefix}_${roomId}`);
			}
		}));
	}
}

SocketModules.chats.sortPublicRooms = async function (socket, data) {
	if (!data || !Array.isArray(data.scores) || !Array.isArray(data.roomIds)) {
		throw new Error('[[error:invalid-data]]');
	}
	const isAdmin = await user.isAdministrator(socket.uid);
	if (!isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}
	await db.sortedSetAdd(`chat:rooms:public:order`, data.scores, data.roomIds);
	require('../cache').del(`chat:rooms:public:order:all`);
};

SocketModules.chats.searchMembers = async function (socket, data) {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const [isAdmin, inRoom, isRoomOwner] = await Promise.all([
		user.isAdministrator(socket.uid),
		Messaging.isUserInRoom(socket.uid, data.roomId),
		Messaging.isRoomOwner(socket.uid, data.roomId),
	]);

	if (!isAdmin && !inRoom) {
		throw new Error('[[error:no-privileges]]');
	}

	const results = await user.search({
		query: data.username,
		paginate: false,
		hardCap: -1,
	});

	const { users } = results;
	const foundUids = users.map(user => user && user.uid);
	const isUidInRoom = _.zipObject(
		foundUids,
		await Messaging.isUsersInRoom(foundUids, data.roomId)
	);

	const roomUsers = users.filter(user => isUidInRoom[user.uid]);
	const isOwners = await Messaging.isRoomOwner(roomUsers.map(u => u.uid), data.roomId);

	roomUsers.forEach((user, index) => {
		if (user) {
			user.isOwner = isOwners[index];
			user.canKick = isRoomOwner && (parseInt(user.uid, 10) !== parseInt(socket.uid, 10));
		}
	});

	roomUsers.sort((a, b) => {
		if (a.isOwner && !b.isOwner) {
			return -1;
		} else if (!a.isOwner && b.isOwner) {
			return 1;
		}
		return 0;
	});
	return { users: roomUsers };
};

SocketModules.chats.toggleOwner = async (socket, data) => {
	if (!data || !data.uid || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	const [isAdmin, inRoom, isRoomOwner] = await Promise.all([
		user.isAdministrator(socket.uid),
		Messaging.isUserInRoom(socket.uid, data.roomId),
		Messaging.isRoomOwner(socket.uid, data.roomId),
	]);
	if (!isAdmin && (!inRoom || !isRoomOwner)) {
		throw new Error('[[error:no-privileges]]');
	}

	await Messaging.toggleOwner(data.uid, data.roomId);
};

SocketModules.chats.setNotificationSetting = async (socket, data) => {
	if (!data || !utils.isNumber(data.value) || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	const inRoom = await Messaging.isUserInRoom(socket.uid, data.roomId);
	if (!inRoom) {
		throw new Error('[[error:no-privileges]]');
	}

	await Messaging.setUserNotificationSetting(socket.uid, data.roomId, data.value);
};

SocketModules.chats.searchMessages = async (socket, data) => {
	if (!data || !utils.isNumber(data.roomId) || !data.content) {
		throw new Error('[[error:invalid-data]]');
	}
	const [roomData, inRoom] = await Promise.all([
		Messaging.getRoomData(data.roomId),
		Messaging.isUserInRoom(socket.uid, data.roomId),
	]);

	if (!roomData) {
		throw new Error('[[error:no-room]]');
	}
	if (!inRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	const { ids } = await plugins.hooks.fire('filter:messaging.searchMessages', {
		content: data.content,
		roomId: [data.roomId],
		uid: [data.uid],
		matchWords: 'any',
		ids: [],
	});

	let userjoinTimestamp = 0;
	if (!roomData.public) {
		userjoinTimestamp = await db.sortedSetScore(`chat:room:${data.roomId}:uids`, socket.uid);
	}
	const messageData = await Messaging.getMessagesData(ids, socket.uid, data.roomId, false);
	messageData.forEach((msg) => {
		if (msg) {
			msg.newSet = true;
		}
	});

	return messageData.filter(msg => msg && !msg.deleted && msg.timestamp > userjoinTimestamp);
};

SocketModules.chats.loadPinnedMessages = async (socket, data) => {
	if (!data || !data.roomId || !utils.isNumber(data.start)) {
		throw new Error('[[error:invalid-data]]');
	}
	const isInRoom = await Messaging.isUserInRoom(socket.uid, data.roomId);
	if (!isInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	const start = parseInt(data.start, 10) || 0;
	const pinnedMsgs = await Messaging.getPinnedMessages(data.roomId, socket.uid, start, start + 49);
	return pinnedMsgs;
};

SocketModules.chats.typing = async (socket, data) => {
	if (!data || !utils.isNumber(data.roomId) || typeof data.typing !== 'boolean') {
		throw new Error('[[error:invalid-data]]');
	}
	const isInRoom = await Messaging.isUserInRoom(socket.uid, data.roomId);
	if (!isInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	socket.to(`chat_room_${data.roomId}`).emit('event:chats.typing', {
		uid: socket.uid,
		roomId: data.roomId,
		typing: data.typing,
		username: validator.escape(String(data.username)),
	});
};


require('../promisify')(SocketModules);
