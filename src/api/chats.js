'use strict';

const meta = require('../meta');
const privileges = require('../privileges');
const messaging = require('../messaging');


const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');

const chatsAPI = module.exports;

function rateLimitExceeded(caller) {
	const session = caller.request ? caller.request.session : caller.session;	// socket vs req
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
