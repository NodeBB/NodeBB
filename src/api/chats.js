'use strict';

const validator = require('validator');

const user = require('../user');
const meta = require('../meta');
const messaging = require('../messaging');
const plugins = require('../plugins');

// const websockets = require('../socket.io');
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

chatsAPI.create = async function (caller, data) {
	if (rateLimitExceeded(caller)) {
		throw new Error('[[error:too-many-messages]]');
	}

	if (!data.uids || !Array.isArray(data.uids)) {
		throw new Error(`[[error:wrong-parameter-type, uids, ${typeof data.uids}, Array]]`);
	}

	await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));
	const roomId = await messaging.newRoom(caller.uid, data.uids);

	return await messaging.getRoomData(roomId);
};

chatsAPI.post = async (caller, data) => {
	if (rateLimitExceeded(caller)) {
		throw new Error('[[error:too-many-messages]]');
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
	await messaging.renameRoom(caller.uid, data.roomId, data.name);
	const uids = await messaging.getUidsInRoom(data.roomId, 0, -1);
	const eventData = { roomId: data.roomId, newName: validator.escape(String(data.name)) };

	socketHelpers.emitToUids('event:chats.roomRename', eventData, uids);
	return messaging.loadRoom(caller.uid, {
		roomId: data.roomId,
	});
};

chatsAPI.users = async (caller, data) => {
	const [isOwner, users] = await Promise.all([
		messaging.isRoomOwner(caller.uid, data.roomId),
		messaging.getUsersInRoom(data.roomId, 0, -1),
	]);
	users.forEach((user) => {
		user.canKick = (parseInt(user.uid, 10) !== parseInt(caller.uid, 10)) && isOwner;
	});
	return { users };
};

chatsAPI.invite = async (caller, data) => {
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
