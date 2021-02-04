'use strict';


const validator = require('validator');

const db = require('../database');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const utils = require('../utils');

const Messaging = module.exports;

require('./data')(Messaging);
require('./create')(Messaging);
require('./delete')(Messaging);
require('./edit')(Messaging);
require('./rooms')(Messaging);
require('./unread')(Messaging);
require('./notifications')(Messaging);


Messaging.getMessages = async (params) => {
	const isNew = params.isNew || false;
	const start = params.hasOwnProperty('start') ? params.start : 0;
	const stop = parseInt(start, 10) + ((params.count || 50) - 1);

	const indices = {};
	const ok = await canGet('filter:messaging.canGetMessages', params.callerUid, params.uid);
	if (!ok) {
		return;
	}

	const mids = await db.getSortedSetRevRange(`uid:${params.uid}:chat:room:${params.roomId}:mids`, start, stop);
	if (!mids.length) {
		return [];
	}
	mids.forEach((mid, index) => {
		indices[mid] = start + index;
	});
	mids.reverse();

	const messageData = await Messaging.getMessagesData(mids, params.uid, params.roomId, isNew);
	messageData.forEach((messageData) => {
		messageData.index = indices[messageData.messageId.toString()];
		messageData.isOwner = messageData.fromuid === parseInt(params.uid, 10);
		if (messageData.deleted && !messageData.isOwner) {
			messageData.content = '[[modules:chat.message-deleted]]';
		}
	});

	return messageData;
};

async function canGet(hook, callerUid, uid) {
	const data = await plugins.hooks.fire(hook, {
		callerUid: callerUid,
		uid: uid,
		canGet: parseInt(callerUid, 10) === parseInt(uid, 10),
	});

	return data ? data.canGet : false;
}

Messaging.parse = async (message, fromuid, uid, roomId, isNew) => {
	const parsed = await plugins.hooks.fire('filter:parse.raw', message);
	let messageData = {
		message: message,
		parsed: parsed,
		fromuid: fromuid,
		uid: uid,
		roomId: roomId,
		isNew: isNew,
		parsedMessage: parsed,
	};

	messageData = await plugins.hooks.fire('filter:messaging.parse', messageData);
	return messageData ? messageData.parsedMessage : '';
};

Messaging.isNewSet = async (uid, roomId, timestamp) => {
	const setKey = `uid:${uid}:chat:room:${roomId}:mids`;
	const messages = await db.getSortedSetRevRangeWithScores(setKey, 0, 0);
	if (messages && messages.length) {
		return parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + Messaging.newMessageCutoff;
	}
	return true;
};

Messaging.getRecentChats = async (callerUid, uid, start, stop) => {
	const ok = await canGet('filter:messaging.canGetRecentChats', callerUid, uid);
	if (!ok) {
		return null;
	}

	const roomIds = await db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, start, stop);
	const results = await utils.promiseParallel({
		roomData: Messaging.getRoomsData(roomIds),
		unread: db.isSortedSetMembers(`uid:${uid}:chat:rooms:unread`, roomIds),
		users: Promise.all(roomIds.map(async (roomId) => {
			let uids = await db.getSortedSetRevRange(`chat:room:${roomId}:uids`, 0, 9);
			uids = uids.filter(_uid => _uid && parseInt(_uid, 10) !== parseInt(uid, 10));
			return await user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline']);
		})),
		teasers: Promise.all(roomIds.map(async roomId => Messaging.getTeaser(uid, roomId))),
	});

	results.roomData.forEach((room, index) => {
		if (room) {
			room.users = results.users[index];
			room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : room.users.length > 2;
			room.unread = results.unread[index];
			room.teaser = results.teasers[index];

			room.users.forEach((userData) => {
				if (userData && parseInt(userData.uid, 10)) {
					userData.status = user.getStatus(userData);
				}
			});
			room.users = room.users.filter(user => user && parseInt(user.uid, 10));
			room.lastUser = room.users[0];

			room.usernames = Messaging.generateUsernames(room.users, uid);
		}
	});

	results.roomData = results.roomData.filter(Boolean);
	const ref = { rooms: results.roomData, nextStart: stop + 1 };
	return await plugins.hooks.fire('filter:messaging.getRecentChats', {
		rooms: ref.rooms,
		nextStart: ref.nextStart,
		uid: uid,
		callerUid: callerUid,
	});
};

Messaging.generateUsernames = (users, excludeUid) => users.filter(user => user && parseInt(user.uid, 10) !== excludeUid)
	.map(user => user.username).join(', ');

Messaging.getTeaser = async (uid, roomId) => {
	const mid = await Messaging.getLatestUndeletedMessage(uid, roomId);
	if (!mid) {
		return null;
	}
	const teaser = await Messaging.getMessageFields(mid, ['fromuid', 'content', 'timestamp']);
	if (!teaser.fromuid) {
		return null;
	}
	const blocked = await user.blocks.is(teaser.fromuid, uid);
	if (blocked) {
		return null;
	}

	teaser.user = await user.getUserFields(teaser.fromuid, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline']);
	if (teaser.content) {
		teaser.content = utils.stripHTMLTags(utils.decodeHTMLEntities(teaser.content));
		teaser.content = validator.escape(String(teaser.content));
	}

	const payload = await plugins.hooks.fire('filter:messaging.getTeaser', { teaser: teaser });
	return payload.teaser;
};

Messaging.getLatestUndeletedMessage = async (uid, roomId) => {
	let done = false;
	let latestMid = null;
	let index = 0;
	let mids;

	while (!done) {
		/* eslint-disable no-await-in-loop */
		mids = await db.getSortedSetRevRange(`uid:${uid}:chat:room:${roomId}:mids`, index, index);
		if (mids.length) {
			const states = await Messaging.getMessageFields(mids[0], ['deleted', 'system']);
			done = !states.deleted && !states.system;
			if (done) {
				latestMid = mids[0];
			}
			index += 1;
		} else {
			done = true;
		}
	}

	return latestMid;
};

Messaging.canMessageUser = async (uid, toUid) => {
	if (meta.config.disableChat || uid <= 0 || uid === toUid) {
		throw new Error('[[error:chat-disabled]]');
	}

	if (parseInt(uid, 10) === parseInt(toUid, 10)) {
		throw new Error('[[error:cant-chat-with-yourself');
	}

	const exists = await user.exists(toUid);
	if (!exists) {
		throw new Error('[[error:no-user]]');
	}

	const canChat = await privileges.global.can('chat', uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}

	const results = await utils.promiseParallel({
		settings: user.getSettings(toUid),
		isAdmin: user.isAdministrator(uid),
		isModerator: user.isModeratorOfAnyCategory(uid),
		isFollowing: user.isFollowing(toUid, uid),
	});

	if (results.settings.restrictChat && !results.isAdmin && !results.isModerator && !results.isFollowing) {
		throw new Error('[[error:chat-restricted]]');
	}

	await plugins.hooks.fire('static:messaging.canMessageUser', {
		uid: uid,
		toUid: toUid,
	});
};

Messaging.canMessageRoom = async (uid, roomId) => {
	if (meta.config.disableChat || uid <= 0) {
		throw new Error('[[error:chat-disabled]]');
	}

	const inRoom = await Messaging.isUserInRoom(uid, roomId);
	if (!inRoom) {
		throw new Error('[[error:not-in-room]]');
	}

	const canChat = await privileges.global.can('chat', uid);
	if (!canChat) {
		throw new Error('[[error:no-privileges]]');
	}

	await plugins.hooks.fire('static:messaging.canMessageRoom', {
		uid: uid,
		roomId: roomId,
	});
};

Messaging.hasPrivateChat = async (uid, withUid) => {
	if (parseInt(uid, 10) === parseInt(withUid, 10)) {
		return 0;
	}

	const results = await utils.promiseParallel({
		myRooms: db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, 0, -1),
		theirRooms: db.getSortedSetRevRange(`uid:${withUid}:chat:rooms`, 0, -1),
	});
	const roomIds = results.myRooms.filter(roomId => roomId && results.theirRooms.includes(roomId));

	if (!roomIds.length) {
		return 0;
	}

	var index = 0;
	var roomId = 0;
	while (index < roomIds.length && !roomId) {
		/* eslint-disable no-await-in-loop */
		const count = await Messaging.getUserCountInRoom(roomIds[index]);
		if (count === 2) {
			roomId = roomIds[index];
		} else {
			index += 1;
		}
	}

	return roomId;
};

require('../promisify')(Messaging);
