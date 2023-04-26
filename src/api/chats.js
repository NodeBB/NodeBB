'use strict';

const validator = require('validator');

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
	if (!data.uids || !Array.isArray(data.uids)) {
		throw new Error(`[[error:wrong-parameter-type, uids, ${typeof data.uids}, Array]]`);
	}

	await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));
	const roomId = await messaging.newRoom(caller.uid, data.uids);

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
		timestamp: Date.now(),
		ip: caller.ip,
	});
	messaging.notifyUsersInRoom(caller.uid, data.roomId, message);
	user.updateOnlineUsers(caller.uid);

	return message;
};

chatsAPI.rename = async (caller, data) => {
	if (!data || !data.roomId || !data.name) {
		throw new Error('[[error:invalid-data]]');
	}
	await messaging.renameRoom(caller.uid, data.roomId, data.name);
	const uids = await messaging.getUidsInRoom(data.roomId, 0, -1);
	const eventData = { roomId: data.roomId, newName: validator.escape(String(data.name)) };

	socketHelpers.emitToUids('event:chats.roomRename', eventData, uids);
	return messaging.loadRoom(caller.uid, {
		roomId: data.roomId,
	});
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

		const uidsInRoom = await messaging.getUidsInRoom(roomId, 0, -1);
		if (!uidsInRoom.includes(String(caller.uid))) {
			return;
		}

		// Mark notification read
		const nids = uidsInRoom.filter(uid => parseInt(uid, 10) !== caller.uid)
			.map(uid => `chat_${uid}_${roomId}`);

		await notifications.markReadMultiple(nids, caller.uid);
		await user.notifications.pushCount(caller.uid);
	}

	socketHelpers.emitToUids('event:chats.mark', { roomId, state }, [caller.uid]);
	messaging.pushUnreadCount(caller.uid);

	return messaging.loadRoom(caller.uid, { roomId });
};

chatsAPI.users = async (caller, data) => {
	const [isOwner, isUserInRoom, users] = await Promise.all([
		messaging.isRoomOwner(caller.uid, data.roomId),
		messaging.isUserInRoom(caller.uid, data.roomId),
		messaging.getUsersInRoom(data.roomId, 0, -1),
	]);
	if (!isUserInRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	users.forEach((user) => {
		user.canKick = (parseInt(user.uid, 10) !== parseInt(caller.uid, 10)) && isOwner;
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

	const userCount = await messaging.getUserCountInRoom(data.roomId);
	const maxUsers = meta.config.maximumUsersInChatRoom;
	if (maxUsers && userCount >= maxUsers) {
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
	} else {
		await messaging.removeUsersFromRoom(caller.uid, data.uids, data.roomId);
	}

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
