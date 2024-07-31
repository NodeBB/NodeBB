'use strict';

const validator = require('validator');
const winston = require('winston');

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const messaging = require('../messaging');
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const utils = require('../utils');

const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');

const chatsAPI = module.exports;

async function rateLimitExceeded(caller, field) {
	const session = caller.request ? caller.request.session : caller.session; // socket vs req
	const now = Date.now();
	const [isPrivileged, reputation] = await Promise.all([
		user.isPrivileged(caller.uid),
		user.getUserField(caller.uid, 'reputation'),
	]);
	const newbie = !isPrivileged && meta.config.newbieReputationThreshold > reputation;
	const delay = newbie ? meta.config.newbieChatMessageDelay : meta.config.chatMessageDelay;
	session[field] = session[field] || 0;

	if (now - session[field] < delay) {
		return true;
	}

	session[field] = now;
	return false;
}

chatsAPI.list = async (caller, { uid = caller.uid, start, stop, page, perPage } = {}) => {
	if ((!utils.isNumber(start) || !utils.isNumber(stop)) && !utils.isNumber(page)) {
		throw new Error('[[error:invalid-data]]');
	}

	if (!start && !stop && page) {
		winston.warn('[api/chats] Sending `page` and `perPage` to .list() is deprecated in favour of `start` and `stop`. The deprecated parameters will be removed in v4.');
		start = Math.max(0, page - 1) * perPage;
		stop = start + perPage - 1;
	}

	return await messaging.getRecentChats(caller.uid, uid || caller.uid, start, stop);
};

chatsAPI.create = async function (caller, data) {
	if (await rateLimitExceeded(caller, 'lastChatRoomCreateTime')) {
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

	await Promise.all(data.uids.map(uid => messaging.canMessageUser(caller.uid, uid)));
	const roomId = await messaging.newRoom(caller.uid, data);

	return await messaging.getRoomData(roomId);
};

chatsAPI.getUnread = async (caller) => {
	const count = await messaging.getUnreadCount(caller.uid);
	return { count };
};

chatsAPI.sortPublicRooms = async (caller, { roomIds, scores }) => {
	[roomIds, scores].forEach((arr) => {
		if (!Array.isArray(arr) || !arr.every(value => isFinite(value))) {
			throw new Error('[[error:invalid-data]]');
		}
	});

	const isAdmin = await user.isAdministrator(caller.uid);
	if (!isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}

	await db.sortedSetAdd(`chat:rooms:public:order`, scores, roomIds);
	require('../cache').del(`chat:rooms:public:order:all`);
};

chatsAPI.get = async (caller, { uid, roomId }) => await messaging.loadRoom(caller.uid, { uid, roomId });

chatsAPI.post = async (caller, data) => {
	if (await rateLimitExceeded(caller, 'lastChatMessageTime')) {
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

chatsAPI.watch = async (caller, { roomId, state }) => {
	const inRoom = await messaging.isUserInRoom(caller.uid, roomId);
	if (!inRoom) {
		throw new Error('[[error:no-privileges]]');
	}

	await messaging.setUserNotificationSetting(caller.uid, roomId, state);
};

chatsAPI.toggleTyping = async (caller, { roomId, typing }) => {
	if (!utils.isNumber(roomId) || typeof typing !== 'boolean') {
		throw new Error('[[error:invalid-data]]');
	}

	const [isInRoom, username] = await Promise.all([
		messaging.isUserInRoom(caller.uid, roomId),
		user.getUserField(caller.uid, 'username'),
	]);
	if (!isInRoom) {
		throw new Error('[[error:no-privileges]]');
	}

	websockets.in(`chat_room_${roomId}`).emit('event:chats.typing', {
		uid: caller.uid,
		roomId,
		typing,
		username,
	});
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
	if (!data || !data.roomId || !Array.isArray(data.uids)) {
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
	await Promise.all(data.uids.map(uid => messaging.canMessageUser(caller.uid, uid)));
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

chatsAPI.toggleOwner = async (caller, { roomId, uid, state }) => {
	const [isAdmin, inRoom, isRoomOwner] = await Promise.all([
		user.isAdministrator(caller.uid),
		messaging.isUserInRoom(caller.uid, roomId),
		messaging.isRoomOwner(caller.uid, roomId),
	]);

	if (!isAdmin && (!inRoom || !isRoomOwner)) {
		throw new Error('[[error:no-privileges]]');
	}

	return await messaging.toggleOwner(uid, roomId, state);
};

chatsAPI.listMessages = async (caller, { uid = caller.uid, roomId, start = 0, direction = null } = {}) => {
	if (!roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	const count = 50;
	let stop = start + count - 1;
	if (direction === 1 || direction === -1) {
		const msgCount = await db.getObjectField(`chat:room:${roomId}`, 'messageCount');
		start = msgCount - start;
		if (direction === 1) {
			start -= count + 1;
		}
		stop = start + count - 1;
		start = Math.max(0, start);
		if (stop <= -1) {
			return { messages: [] };
		}
		stop = Math.max(0, stop);
	}

	const messages = await messaging.getMessages({
		callerUid: caller.uid,
		uid,
		roomId,
		start,
		count: stop - start + 1,
	});

	return { messages };
};

chatsAPI.getPinnedMessages = async (caller, { start, roomId }) => {
	start = parseInt(start, 10) || 0;
	const isInRoom = await messaging.isUserInRoom(caller.uid, roomId);
	if (!isInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	const messages = await messaging.getPinnedMessages(roomId, caller.uid, start, start + 49);
	return { messages };
};

chatsAPI.getMessage = async (caller, { mid, roomId } = {}) => {
	if (!mid || !roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	const messages = await messaging.getMessagesData([mid], caller.uid, roomId, false);
	return messages.pop();
};

chatsAPI.getRawMessage = async (caller, { mid, roomId } = {}) => {
	if (!mid || !roomId) {
		throw new Error('[[error:invalid-data]]');
	}

	const [isAdmin, canViewMessage, inRoom] = await Promise.all([
		user.isAdministrator(caller.uid),
		messaging.canViewMessage(mid, roomId, caller.uid),
		messaging.isUserInRoom(caller.uid, roomId),
	]);

	if (!isAdmin && (!inRoom || !canViewMessage)) {
		throw new Error('[[error:not-allowed]]');
	}

	const content = await messaging.getMessageField(mid, 'content');
	return { content };
};

chatsAPI.getIpAddress = async (caller, { mid }) => {
	const allowed = await privileges.global.can('view:users:info', caller.uid);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}
	const ip = await messaging.getMessageField(mid, 'ip');
	return { ip };
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
