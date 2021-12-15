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
		throw new Error(`[[error:array-expected, uids, ${typeof data.uids}]]`);
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
