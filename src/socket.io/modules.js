'use strict';

/**
 * v4 note — all methods here are deprecated and can be removed except for:
 *   - SocketModules.chats.(enter|leave)(Public)?  => related to socket.io rooms
 */

const Messaging = require('../messaging');
const utils = require('../utils');
const user = require('../user');
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
	sockets.warnDeprecated(socket, 'GET /api/v3/chats/unread');

	const { count } = await api.chats.getUnread(socket);
	return count;
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
	sockets.warnDeprecated(socket, 'PUT /api/v3/chats/sort');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	await api.chats.sortPublicRooms(socket, data);
};

SocketModules.chats.searchMembers = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/search/chats/:roomId/users?query=');

	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	// parameter renamed; backwards compatibility
	data.query = data.username;
	delete data.username;
	return await api.search.roomUsers(socket, data);
};

SocketModules.chats.toggleOwner = async (socket, data) => {
	sockets.warnDeprecated(socket, 'PUT/DELETE /api/v3/chats/:roomId/owners/:uid');

	if (!data || !data.uid || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	await api.chats.toggleOwner(socket, data);
};

SocketModules.chats.setNotificationSetting = async (socket, data) => {
	sockets.warnDeprecated(socket, 'PUT/DELETE /api/v3/chats/:roomId/watch');

	if (!data || !utils.isNumber(data.value) || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	await api.chats.watch(socket, data);
};

SocketModules.chats.searchMessages = async (socket, data) => {
	sockets.warnDeprecated(socket, 'GET /api/v3/search/chats/:roomId/messages');

	if (!data || !utils.isNumber(data.roomId) || !data.content) {
		throw new Error('[[error:invalid-data]]');
	}

	// parameter renamed; backwards compatibility
	data.query = data.content;
	delete data.content;
	return await api.search.roomMessages(socket, data);
};

SocketModules.chats.loadPinnedMessages = async (socket, data) => {
	sockets.warnDeprecated(socket, 'GET /api/v3/chats/:roomId/messages/pinned');

	if (!data || !data.roomId || !utils.isNumber(data.start)) {
		throw new Error('[[error:invalid-data]]');
	}

	const { messages } = await api.chats.getPinnedMessages(socket, data);
	return messages;
};

SocketModules.chats.typing = async (socket, data) => {
	sockets.warnDeprecated(socket, 'PUT /api/v3/chats/:roomId/typing');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	// `username` is now inferred from caller uid
	delete data.username;

	await api.chats.toggleTyping(socket, data);
};


require('../promisify')(SocketModules);
