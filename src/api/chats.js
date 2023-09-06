'use strict';

const validator = require('validator');

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const messaging = require('../messaging');
const notifications = require('../notifications');
const plugins = require('../plugins');
const privileges = require('../privileges');

const socketHelpers = require('../socket.io/helpers');

const chatsAPI = module.exports;

function rateLimitExceeded(caller) {
	const session = caller.request ? caller.request.session : caller.session; // socket vs req
	const now = Date.now();
	session.lastChatMessageTime = session.lastChatMessageTime || 0;
	if (now - session.lastChatMessageTime < meta.config.chatMessageDelay) {
		return true;
	}
	session.lastChatMessageTime = now;
	return false;
}

chatsAPI.list = async (caller, { page, perPage }) => {
	const start = Math.max(0, page - 1) * perPage;
	const stop = start + perPage;
	const { rooms } = await messaging.getRecentChats(caller.uid, caller.uid, start, stop);

	return { rooms };
};

chatsAPI.create = async function (caller, data) {
	if (rateLimitExceeded(caller)) {
		throw new Error('[[error:too-many-messages]]');
	}
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const isPublic = data.type === 'public';
	const isAdmin = await user.isAdministrator(caller.uid);
	if (isPublic && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!data.uids || !Array.isArray(data.uids)) {
		throw new Error(`[[error:wrong-parameter-type, uids, ${typeof data.uids}, Array]]`);
	}

	if (!isPublic && !data.uids.length) {
		throw new Error('[[error:no-users-selected]]');
	}
	if (isPublic && (!Array.isArray(data.groups) || !data.groups.length)) {
		throw new Error('[[error:no-groups-selected]]');
	}

	data.notificationSetting = isPublic ?
		messaging.notificationSettings.ATMENTION :
		messaging.notificationSettings.ALLMESSAGES;

	await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));
	const roomId = await messaging.newRoom(caller.uid, data);

	return await messaging.getRoomData(roomId);
};

chatsAPI.get = async (caller, { uid, roomId }) => await messaging.loadRoom(caller.uid, { uid, roomId });

chatsAPI.post = async (caller, data) => {
	if (rateLimitExceeded(caller)) {
		throw new Error('[[error:too-many-messages]]');
	}
	if (!data || !data.roomId || !caller.uid) {
		throw new Error('[[error:invalid-data]]');
	}

	({ data } = await plugins.hooks.fire('filter:messaging.send', {
		data,
		uid: caller.uid,
	}));

	await messaging.canMessageRoom(caller.uid, data.roomId);
	const message = await messaging.sendMessage({
		uid: caller.uid,
		roomId: data.roomId,
		content: data.message,
		toMid: data.toMid,
		timestamp: Date.now(),
		ip: caller.ip,
	});
	messaging.notifyUsersInRoom(caller.uid, data.roomId, message);
	user.updateOnlineUsers(caller.uid);

	return message;
};

chatsAPI.update = async (caller, data) => {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	if (data.hasOwnProperty('name')) {
		if (!data.name && data.name !== '') {
			throw new Error('[[error:invalid-data]]');
		}
		await messaging.renameRoom(caller.uid, data.roomId, data.name);
	}
	const [roomData, isAdmin] = await Promise.all([
		messaging.getRoomData(data.roomId),
		user.isAdministrator(caller.uid),
	]);
	if (!roomData) {
		throw new Error('[[error:invalid-data]]');
	}
	if (data.hasOwnProperty('groups')) {
		if (roomData.public && isAdmin) {
			await db.setObjectField(`chat:room:${data.roomId}`, 'groups', JSON.stringify(data.groups));
		}
	}
	if (data.hasOwnProperty('notificationSetting') && isAdmin) {
		await db.setObjectField(`chat:room:${data.roomId}`, 'notificationSetting', data.notificationSetting);
	}
	const loadedRoom = await messaging.loadRoom(caller.uid, {
		roomId: data.roomId,
	});
	if (data.hasOwnProperty('name')) {
		const ioRoom = require('../socket.io').in(`chat_room_${data.roomId}`);
		if (ioRoom) {
			ioRoom.emit('event:chats.roomRename', {
				roomId: data.roomId,
				newName: validator.escape(String(data.name)),
				chatWithMessage: loadedRoom.chatWithMessage,
			});
		}
	}
	return loadedRoom;
};

chatsAPI.rename = async (caller, data) => {
	if (!data || !data.roomId || !data.name) {
		throw new Error('[[error:invalid-data]]');
	}
	return await chatsAPI.update(caller, data);
};

chatsAPI.mark = async (caller, data) => {
	if (!caller.uid || !data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const { roomId, state } = data;
	if (state) {
		await messaging.markUnread([caller.uid], roomId);
	} else {
		await messaging.markRead(caller.uid, roomId);
		socketHelpers.emitToUids('event:chats.markedAsRead', { roomId: roomId }, [caller.uid]);
		const nids = await user.notifications.getUnreadByField(caller.uid, 'roomId', [roomId]);
		await notifications.markReadMultiple(nids, caller.uid);
		user.notifications.pushCount(caller.uid);
	}

	socketHelpers.emitToUids('event:chats.mark', { roomId, state }, [caller.uid]);
	messaging.pushUnreadCount(caller.uid);
};

chatsAPI.users = async (caller, data) => {
	const start = data.hasOwnProperty('start') ? data.start : 0;
	const stop = start + 39;
	const io = require('../socket.io');
	const [isOwner, isUserInRoom, users, isAdmin, onlineUids] = await Promise.all([
		messaging.isRoomOwner(caller.uid, data.roomId),
		messaging.isUserInRoom(caller.uid, data.roomId),
		messaging.getUsersInRoomFromSet(
			`chat:room:${data.roomId}:uids:online`, data.roomId, start, stop, true
		),
		user.isAdministrator(caller.uid),
		io.getUidsInRoom(`chat_room_${data.roomId}`),
	]);
	if (!isUserInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	users.forEach((user) => {
		const isSelf = parseInt(user.uid, 10) === parseInt(caller.uid, 10);
		user.canKick = isOwner && !isSelf;
		user.canToggleOwner = (isAdmin || isOwner) && !isSelf;
		user.online = parseInt(user.uid, 10) === parseInt(caller.uid, 10) || onlineUids.includes(String(user.uid));
	});
	return { users };
};

chatsAPI.invite = async (caller, data) => {
	const canChat = await privileges.global.can('chat', caller.uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const roomData = await messaging.getRoomData(data.roomId);
	if (!roomData) {
		throw new Error('[[error:invalid-data]]');
	}
	const userCount = await messaging.getUserCountInRoom(data.roomId);
	const maxUsers = meta.config.maximumUsersInChatRoom;
	if (!roomData.public && maxUsers && userCount >= maxUsers) {
		throw new Error('[[error:cant-add-more-users-to-chat-room]]');
	}

	const uidsExist = await user.exists(data.uids);
	if (!uidsExist.every(Boolean)) {
		throw new Error('[[error:no-user]]');
	}
	await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));
	await messaging.addUsersToRoom(caller.uid, data.uids, data.roomId);

	delete data.uids;
	return chatsAPI.users(caller, data);
};

chatsAPI.kick = async (caller, data) => {
	if (!data || !data.roomId) {
		throw new Error('[[error:invalid-data]]');
	}
	const uidsExist = await user.exists(data.uids);
	if (!uidsExist.every(Boolean)) {
		throw new Error('[[error:no-user]]');
	}

	// Additional checks if kicking vs leaving
	if (data.uids.length === 1 && parseInt(data.uids[0], 10) === caller.uid) {
		await messaging.leaveRoom([caller.uid], data.roomId);
		await socketHelpers.removeSocketsFromRoomByUids([caller.uid], data.roomId);
		return [];
	}
	await messaging.removeUsersFromRoom(caller.uid, data.uids, data.roomId);
	await socketHelpers.removeSocketsFromRoomByUids(data.uids, data.roomId);
	delete data.uids;
	return chatsAPI.users(caller, data);
};

chatsAPI.listMessages = async (caller, { uid, roomId, start }) => {
	const messages = await messaging.getMessages({
		callerUid: caller.uid,
		uid,
		roomId,
		start,
		count: 50,
	});

	return { messages };
};

chatsAPI.getMessage = async (caller, { mid, roomId }) => {
	const messages = await messaging.getMessagesData([mid], caller.uid, roomId, false);
	return messages.pop();
};

chatsAPI.editMessage = async (caller, { mid, roomId, message }) => {
	await messaging.canEdit(mid, caller.uid);
	await messaging.editMessage(caller.uid, mid, roomId, message);
};

chatsAPI.deleteMessage = async (caller, { mid }) => {
	await messaging.canDelete(mid, caller.uid);
	await messaging.deleteMessage(mid, caller.uid);
};

chatsAPI.restoreMessage = async (caller, { mid }) => {
	await messaging.canDelete(mid, caller.uid);
	await messaging.restoreMessage(mid, caller.uid);
};

chatsAPI.pinMessage = async (caller, { roomId, mid }) => {
	await messaging.canPin(roomId, caller.uid);
	await messaging.pinMessage(mid, roomId);
};

chatsAPI.unpinMessage = async (caller, { roomId, mid }) => {
	await messaging.canPin(roomId, caller.uid);
	await messaging.unpinMessage(mid, roomId);
};
