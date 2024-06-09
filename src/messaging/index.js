'use strict';

const _ = require('lodash');
const validator = require('validator');
const nconf = require('nconf');
const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const utils = require('../utils');
const translator = require('../translator');
const cache = require('../cache');

const relative_path = nconf.get('relative_path');

const Messaging = module.exports;

require('./data')(Messaging);
require('./create')(Messaging);
require('./delete')(Messaging);
require('./edit')(Messaging);
require('./rooms')(Messaging);
require('./unread')(Messaging);
require('./notifications')(Messaging);
require('./pins')(Messaging);

Messaging.notificationSettings = Object.create(null);
Messaging.notificationSettings.NONE = 1;
Messaging.notificationSettings.ATMENTION = 2;
Messaging.notificationSettings.ALLMESSAGES = 3;

Messaging.messageExists = async mid => db.exists(`message:${mid}`);

Messaging.getMessages = async (params) => {
	const { callerUid, uid, roomId } = params;
	const isNew = params.isNew || false;
	const start = params.hasOwnProperty('start') ? params.start : 0;
	const stop = parseInt(start, 10) + ((params.count || 50) - 1);

	const ok = await canGet('filter:messaging.canGetMessages', callerUid, uid);
	if (!ok) {
		return;
	}
	const [mids, messageCount] = await Promise.all([
		getMessageIds(roomId, uid, start, stop),
		db.getObjectField(`chat:room:${roomId}`, 'messageCount'),
	]);
	if (!mids.length) {
		return [];
	}
	const count = parseInt(messageCount, 10) || 0;
	const indices = {};
	mids.forEach((mid, index) => {
		indices[mid] = count - start - index - 1;
	});
	mids.reverse();

	const messageData = await Messaging.getMessagesData(mids, uid, roomId, isNew);
	messageData.forEach((msg) => {
		msg.index = indices[msg.messageId.toString()];
	});

	return messageData;
};

async function getMessageIds(roomId, uid, start, stop) {
	const isPublic = await db.getObjectField(`chat:room:${roomId}`, 'public');
	if (parseInt(isPublic, 10) === 1) {
		return await db.getSortedSetRevRange(
			`chat:room:${roomId}:mids`, start, stop,
		);
	}
	const userjoinTimestamp = await db.sortedSetScore(`chat:room:${roomId}:uids`, uid);
	return await db.getSortedSetRevRangeByScore(
		`chat:room:${roomId}:mids`, start, stop - start + 1, '+inf', userjoinTimestamp
	);
}

async function canGet(hook, callerUid, uid) {
	const data = await plugins.hooks.fire(hook, {
		callerUid: callerUid,
		uid: uid,
		canGet: parseInt(callerUid, 10) === parseInt(uid, 10),
	});

	return data ? data.canGet : false;
}

Messaging.parse = async (message, fromuid, uid, roomId, isNew) => {
	const parsed = await plugins.hooks.fire('filter:parse.raw', String(message || ''));
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
	const setKey = `chat:room:${roomId}:mids`;
	const messages = await db.getSortedSetRevRangeWithScores(setKey, 0, 0);
	if (messages && messages.length) {
		return parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + Messaging.newMessageCutoff;
	}
	return true;
};

Messaging.getPublicRoomIdsFromSet = async function (set) {
	const cacheKey = `${set}:all`;
	let allRoomIds = cache.get(cacheKey);
	if (allRoomIds === undefined) {
		allRoomIds = await db.getSortedSetRange(set, 0, -1);
		cache.set(cacheKey, allRoomIds);
	}
	return allRoomIds.slice();
};

Messaging.getPublicRooms = async (callerUid, uid) => {
	const ok = await canGet('filter:messaging.canGetPublicChats', callerUid, uid);
	if (!ok) {
		return null;
	}

	const allRoomIds = await Messaging.getPublicRoomIdsFromSet('chat:rooms:public:order');
	const allRoomData = await Messaging.getRoomsData(allRoomIds);
	const isAdmin = await privileges.users.isAdministrator(callerUid);
	const checks = await Promise.all(
		allRoomData.map(
			room => room && (
				!Array.isArray(room.groups) ||
				!room.groups.length ||
				isAdmin ||
				groups.isMemberOfAny(uid, room && room.groups)
			)
		)
	);

	const roomData = allRoomData.filter((room, idx) => room && checks[idx]);
	const roomIds = roomData.map(r => r.roomId);
	const userReadTimestamps = await db.getObjectFields(
		`uid:${uid}:chat:rooms:read`,
		roomIds,
	);

	const maxUnread = 50;
	const unreadCounts = await Promise.all(roomIds.map(async (roomId) => {
		const cutoff = userReadTimestamps[roomId] || '-inf';
		const unreadMids = await db.getSortedSetRangeByScore(
			`chat:room:${roomId}:mids`, 0, maxUnread + 1, cutoff, '+inf'
		);
		return unreadMids.length;
	}));

	roomData.forEach((r, idx) => {
		const count = unreadCounts[idx];
		r.unreadCountText = count > maxUnread ? `${maxUnread}+` : String(count);
		r.unreadCount = count;
		r.unread = count > 0;
		r.icon = Messaging.getRoomIcon(r);
	});

	return roomData;
};

Messaging.getRecentChats = async (callerUid, uid, start, stop) => {
	const ok = await canGet('filter:messaging.canGetRecentChats', callerUid, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}

	const roomIds = await db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, start, stop);

	async function getUsers(roomIds) {
		const arrayOfUids = await Promise.all(
			roomIds.map(roomId => Messaging.getUidsInRoom(roomId, 0, 9))
		);
		const uniqUids = _.uniq(_.flatten(arrayOfUids)).filter(
			_uid => _uid && parseInt(_uid, 10) !== parseInt(uid, 10)
		);
		const uidToUser = _.zipObject(
			uniqUids,
			await user.getUsersFields(uniqUids, [
				'uid', 'username', 'userslug', 'picture', 'status', 'lastonline',
			])
		);
		return arrayOfUids.map(uids => uids.map(uid => uidToUser[uid]));
	}

	const results = await utils.promiseParallel({
		roomData: Messaging.getRoomsData(roomIds),
		unread: db.isSortedSetMembers(`uid:${uid}:chat:rooms:unread`, roomIds),
		users: getUsers(roomIds),
		teasers: Messaging.getTeasers(uid, roomIds),
		settings: user.getSettings(uid),
	});

	await Promise.all(results.roomData.map(async (room, index) => {
		if (room) {
			room.users = results.users[index];
			room.groupChat = room.users.length > 2;
			room.unread = results.unread[index];
			room.teaser = results.teasers[index];

			room.users.forEach((userData) => {
				if (userData && parseInt(userData.uid, 10)) {
					userData.status = user.getStatus(userData);
				}
			});
			room.users = room.users.filter(user => user && parseInt(user.uid, 10));
			room.lastUser = room.users[0];
			room.usernames = Messaging.generateUsernames(room, uid);
			room.chatWithMessage = await Messaging.generateChatWithMessage(room, uid, results.settings.userLang);
		}
	}));

	results.roomData = results.roomData.filter(Boolean);
	const ref = { rooms: results.roomData, nextStart: stop + 1 };
	return await plugins.hooks.fire('filter:messaging.getRecentChats', {
		rooms: ref.rooms,
		nextStart: ref.nextStart,
		uid: uid,
		callerUid: callerUid,
	});
};

Messaging.generateUsernames = function (room, excludeUid) {
	const users = room.users.filter(u => u && parseInt(u.uid, 10) !== excludeUid);
	const usernames = users.map(u => u.username);
	if (users.length > 3) {
		return translator.compile(
			'modules:chat.usernames-and-x-others',
			usernames.slice(0, 2).join(', '),
			room.userCount - 2
		);
	}
	return usernames.join(', ');
};

Messaging.generateChatWithMessage = async function (room, callerUid, userLang) {
	const users = room.users.filter(u => u && parseInt(u.uid, 10) !== callerUid);
	const usernames = users.map(u => `<a href="${relative_path}/uid/${u.uid}">${u.username}</a>`);
	let compiled = '';
	if (!users.length) {
		return '[[modules:chat.no-users-in-room]]';
	}
	if (users.length > 3) {
		compiled = translator.compile(
			'modules:chat.chat-with-usernames-and-x-others',
			usernames.slice(0, 2).join(', '),
			room.userCount - 2
		);
	} else {
		compiled = translator.compile(
			'modules:chat.chat-with-usernames',
			usernames.join(', '),
		);
	}
	return utils.decodeHTMLEntities(await translator.translate(compiled, userLang));
};

Messaging.getTeaser = async (uid, roomId) => {
	const teasers = await Messaging.getTeasers(uid, [roomId]);
	return teasers[0];
};

Messaging.getTeasers = async (uid, roomIds) => {
	const mids = await Promise.all(
		roomIds.map(roomId => Messaging.getLatestUndeletedMessage(uid, roomId))
	);
	const [teasers, blockedUids] = await Promise.all([
		Messaging.getMessagesFields(mids, ['fromuid', 'content', 'timestamp']),
		user.blocks.list(uid),
	]);
	const uids = _.uniq(
		teasers.map(t => t && t.fromuid).filter(uid => uid && !blockedUids.includes(uid))
	);

	const userMap = _.zipObject(
		uids,
		await user.getUsersFields(uids, [
			'uid', 'username', 'userslug', 'picture', 'status', 'lastonline',
		])
	);

	return await Promise.all(roomIds.map(async (roomId, idx) => {
		const teaser = teasers[idx];
		if (!teaser || !teaser.fromuid) {
			return null;
		}
		if (userMap[teaser.fromuid]) {
			teaser.user = userMap[teaser.fromuid];
		}
		teaser.content = validator.escape(
			String(utils.stripHTMLTags(utils.decodeHTMLEntities(teaser.content)))
		);
		teaser.roomId = roomId;
		const payload = await plugins.hooks.fire('filter:messaging.getTeaser', { teaser: teaser });
		return payload.teaser;
	}));
};

Messaging.getLatestUndeletedMessage = async (uid, roomId) => {
	let done = false;
	let latestMid = null;
	let index = 0;
	let mids;

	while (!done) {
		/* eslint-disable no-await-in-loop */
		mids = await getMessageIds(roomId, uid, index, index);
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
	if (meta.config.disableChat || uid <= 0) {
		throw new Error('[[error:chat-disabled]]');
	}

	if (parseInt(uid, 10) === parseInt(toUid, 10)) {
		throw new Error('[[error:cant-chat-with-yourself]]');
	}
	const [exists, isTargetPrivileged, canChat, canChatWithPrivileged] = await Promise.all([
		user.exists(toUid),
		user.isPrivileged(toUid),
		privileges.global.can('chat', uid),
		privileges.global.can('chat:privileged', uid),
		checkReputation(uid),
	]);

	if (!exists) {
		throw new Error('[[error:no-user]]');
	}

	if (!canChat && !(canChatWithPrivileged && isTargetPrivileged)) {
		throw new Error('[[error:no-privileges]]');
	}

	const [settings, isAdmin, isModerator, isFollowing, isBlocked] = await Promise.all([
		user.getSettings(toUid),
		user.isAdministrator(uid),
		user.isModeratorOfAnyCategory(uid),
		user.isFollowing(toUid, uid),
		user.blocks.is(uid, toUid),
	]);

	if (isBlocked || (settings.restrictChat && !isAdmin && !isModerator && !isFollowing)) {
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

	const [roomData, inRoom, canChat] = await Promise.all([
		Messaging.getRoomData(roomId),
		Messaging.isUserInRoom(uid, roomId),
		privileges.global.can(['chat', 'chat:privileged'], uid),
		checkReputation(uid),
		user.checkMuted(uid),
	]);
	if (!roomData) {
		throw new Error('[[error:no-room]]');
	}

	if (!inRoom) {
		throw new Error('[[error:not-in-room]]');
	}

	if (!canChat.includes(true)) {
		throw new Error('[[error:no-privileges]]');
	}

	await plugins.hooks.fire('static:messaging.canMessageRoom', {
		uid: uid,
		roomId: roomId,
	});
};

async function checkReputation(uid) {
	if (meta.config['reputation:disabled']) {
		return;
	}
	const [reputation, isPrivileged] = await Promise.all([
		user.getUserField(uid, 'reputation'),
		user.isPrivileged(uid),
	]);
	if (!isPrivileged && meta.config['min:rep:chat'] > reputation) {
		throw new Error(`[[error:not-enough-reputation-to-chat, ${meta.config['min:rep:chat']}]]`);
	}
}

Messaging.hasPrivateChat = async (uid, withUid) => {
	if (parseInt(uid, 10) === parseInt(withUid, 10) ||
		parseInt(uid, 10) <= 0 || parseInt(withUid, 10) <= 0) {
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

	let index = 0;
	let roomId = 0;
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

Messaging.canViewMessage = async (mids, roomId, uid) => {
	let single = false;
	if (!Array.isArray(mids) && isFinite(mids)) {
		mids = [mids];
		single = true;
	}
	const isPublic = parseInt(await db.getObjectField(`chat:room:${roomId}`, 'public'), 10) === 1;
	const [midTimestamps, userTimestamp] = await Promise.all([
		db.sortedSetScores(`chat:room:${roomId}:mids`, mids),
		db.sortedSetScore(`chat:room:${roomId}:uids`, uid),
	]);

	const canView = midTimestamps.map(
		midTimestamp => !!(midTimestamp && userTimestamp && (isPublic || userTimestamp <= midTimestamp))
	);

	return single ? canView.pop() : canView;
};

require('../promisify')(Messaging);
