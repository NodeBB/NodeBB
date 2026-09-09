'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const activitypub = require('../activitypub');
const utils = require('../utils');
const tx = require('../translator');
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

async function getUsers(roomIds, exceptUid) {
	const arrayOfUids = await Promise.all(
		roomIds.map(roomId => Messaging.getUidsInRoomFromSet(`chat:room:${roomId}:uids:online`, 0, 9, true))
	);
	const uniqUids = _.uniq(_.flatten(arrayOfUids)).filter(
		_uid => _uid && parseInt(_uid, 10) !== parseInt(exceptUid, 10)
	);
	const uidToUser = _.zipObject(
		uniqUids,
		await user.getUsersFields(uniqUids, [
			'uid', 'username', 'userslug', 'picture', 'status', 'lastonline',
		])
	);
	return arrayOfUids.map(uids => uids.map(uid => uidToUser[uid]));
}

Messaging.getRecentChats = async (callerUid, uid, start, stop) => {
	const ok = await canGet('filter:messaging.canGetRecentChats', callerUid, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}

	const roomIds = await db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, start, stop);

	const results = await utils.promiseParallel({
		roomData: Messaging.getRoomsData(roomIds),
		unread: db.isSortedSetMembers(`uid:${uid}:chat:rooms:unread`, roomIds),
		inRoom: Messaging.isUserInRoom(uid, roomIds),
		users: getUsers(roomIds, uid),
		teasers: Messaging.getTeasers(uid, roomIds),
	});

	results.roomData = await modifyChatRooms(uid, results);

	const ref = { rooms: results.roomData, nextStart: stop + 1 };
	return await plugins.hooks.fire('filter:messaging.getRecentChats', {
		rooms: ref.rooms,
		nextStart: ref.nextStart,
		uid: uid,
		callerUid: callerUid,
	});
};

Messaging.searchRecentChats = async (callerUid, uid, query) => {
	const ok = await canGet('filter:messaging.canGetRecentChats', callerUid, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}

	const roomIds = await db.getSortedSetRevRange(`uid:${uid}:chat:rooms`, 0, -1);

	// First pass loads only what the query is actually matched against, so the
	// expensive hydration (teasers, unread counts, membership, ...) can be limited
	// to the rooms that matched instead of running over the user's entire chat list.
	const [names, users] = await Promise.all([
		Messaging.getRoomsData(roomIds, ['roomName']),
		getUsers(roomIds, uid),
	]);

	const lowerQuery = String(query).toLowerCase();
	const matchedIndices = roomIds.reduce((matched, roomId, idx) => {
		const roomName = names[idx] && names[idx].roomName;
		const titleMatch = roomName && roomName.toLowerCase().includes(lowerQuery);

		const usernameMatch = !titleMatch && (users[idx] || []).some(user => user && (
			(user.displayname && user.displayname.toLowerCase().includes(lowerQuery)) ||
			(user.username && user.username.toLowerCase().includes(lowerQuery))
		));

		if (titleMatch || usernameMatch) {
			matched.push(idx);
		}
		return matched;
	}, []);

	const matchedRoomIds = matchedIndices.map(idx => roomIds[idx]);
	const results = await utils.promiseParallel({
		roomData: Messaging.getRoomsData(matchedRoomIds),
		unread: db.isSortedSetMembers(`uid:${uid}:chat:rooms:unread`, matchedRoomIds),
		inRoom: Messaging.isUserInRoom(uid, matchedRoomIds),
		teasers: Messaging.getTeasers(uid, matchedRoomIds),
	});
	// reuse the user lists already fetched for matching, kept aligned with roomData
	results.users = matchedIndices.map(idx => users[idx]);

	results.roomData = await modifyChatRooms(uid, results);

	return await plugins.hooks.fire('filter:messaging.searchRecentChats', {
		rooms: results.roomData,
		uid: uid,
		callerUid: callerUid,
	});
};

async function modifyChatRooms(uid, results) {
	const danglingRoomIds = [];
	await Promise.all(results.roomData.map(async (room, index) => {
		// Hide rooms the viewer cannot actually open, mirroring Messaging.loadRoom's
		// visibility check. A private room the viewer is no longer a member of would
		// otherwise show up as an empty/unenterable entry in the chat list.
		if (room && !room.public && results.inRoom && !results.inRoom[index]) {
			danglingRoomIds.push(room.roomId);
			results.roomData[index] = null;
			return;
		}
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
			room.users = room.users.filter(user => user && (parseInt(user.uid, 10) || activitypub.helpers.isUri(user.uid)));
			room.lastUser = room.users[0];
			room.usernames = Messaging.generateUsernames(room, uid);
			room.chatWithMessage = await Messaging.generateChatWithMessage(room, uid);
		}
	}));

	// Self-heal: drop dangling room references from the user's list so they don't
	// keep showing up. These arise when the room set and membership set drift apart.
	if (danglingRoomIds.length) {
		await db.sortedSetRemove([
			`uid:${uid}:chat:rooms`,
			`uid:${uid}:chat:rooms:unread`,
		], danglingRoomIds);
	}

	return results.roomData.filter(Boolean);
}

Messaging.generateUsernames = function (room, excludeUid) {
	const users = room.users.filter(u => u && parseInt(u.uid, 10) !== excludeUid);
	const usernames = users.map(u => u.displayname);
	if (users.length > 3) {
		return tx.compile(
			'modules:chat.usernames-and-x-others',
			usernames.slice(0, 2).map(name => tx.escape(utils.escapeHTML(name))).join(', '),
			room.userCount - 2
		);
	}
	return usernames.join(', ');
};

Messaging.generateChatWithMessage = async function (room, callerUid) {
	let users = room.users.filter(u => u && String(u.uid) !== String(callerUid));
	if (!users.length) {
		return '[[modules:chat.no-users-in-room]]';
	}
	const moreThan3 = users.length > 3;
	users = moreThan3 ? users.slice(0, 2) : users;
	const userData = users.map((u) => {
		const href = utils.isNumber(u.uid) ?
			`${relative_path}/uid/${u.uid}` :
			`${relative_path}/user/${u.username}`;

		return {
			href,
			displayname: String(u.displayname),
		};
	});

	let compiled;
	const txArgs = [];
	userData.forEach((userData) =>{
		txArgs.push(userData.href, tx.escape(utils.escapeHTML(userData.displayname)));
	});
	if (moreThan3) {
		txArgs.push(room.userCount - 2);
		compiled = tx.compile(
			'modules:chat.chat-with-usernames-and-x-others',
			...txArgs
		);
	} else {
		compiled = tx.compile(
			`modules:chat.chat-with-usernames-${userData.length}`,
			...txArgs
		);
	}
	return compiled;
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
		teasers.map(t => t && t.fromuid).filter(uid => uid && !blockedUids.includes(String(uid)))
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
		teaser.content = utils.stripHTMLTags(utils.decodeHTMLEntities(teaser.content));
		teaser.roomId = parseInt(roomId, 10);
		const payload = await plugins.hooks.fire('filter:messaging.getTeaser', { teaser: teaser });
		return payload.teaser;
	}));
};

Messaging.getLatestUndeletedMessage = async (uid, roomId) => {
	// Walk backwards in batches; one message at a time meant two round trips per
	// deleted/system message, and this runs once per room in the chat list.
	const batchSize = 10;
	let index = 0;
	let done = false;

	while (!done) {
		/* eslint-disable no-await-in-loop */
		const mids = await getMessageIds(roomId, uid, index, index + batchSize - 1);
		if (!mids.length) {
			return null;
		}
		const states = await Messaging.getMessagesFields(mids, ['deleted', 'system']);
		const matchIndex = states.findIndex(state => state && !state.deleted && !state.system);
		if (matchIndex !== -1) {
			return mids[matchIndex];
		}
		index += mids.length;
		done = mids.length < batchSize; // short read means we hit the start of the room
	}

	return null;
};

Messaging.canMessageUser = async (uid, toUid) => {
	if (meta.config.disableChat || uid <= 0) {
		throw new Error('[[error:chat-disabled]]');
	}

	if (parseInt(uid, 10) === parseInt(toUid, 10)) {
		throw new Error('[[error:cant-chat-with-yourself]]');
	}
	const [exists, isTargetPrivileged, [canChat, canChatWithPrivileged]] = await Promise.all([
		user.exists(toUid),
		user.isPrivileged(toUid),
		privileges.global.can(['chat', 'chat:privileged'], uid),
	]);

	if (!exists) {
		throw new Error('[[error:no-user]]');
	}

	if (!canChat && !(canChatWithPrivileged && isTargetPrivileged)) {
		throw new Error('[[error:no-privileges]]');
	}

	// only check reputation when messaging regular users
	if (!isTargetPrivileged) {
		await checkReputation(uid);
	}

	const [settings, isAdmin, isModerator, isBlocked] = await Promise.all([
		user.getSettings(toUid),
		user.isAdministrator(uid),
		user.isModeratorOfAnyCategory(uid),
		user.blocks.is(uid, toUid),
	]);

	if (isBlocked) {
		throw new Error('[[error:chat-user-blocked]]');
	}
	const isPrivileged = isAdmin || isModerator;
	if (!isPrivileged) {
		if (settings.disableIncomingChats) {
			throw new Error('[[error:chat-restricted]]');
		}
		if (settings.chatAllowList.length && !settings.chatAllowList.includes(String(uid))) {
			throw new Error('[[error:chat-restricted]]');
		}
		if (settings.chatDenyList.length && settings.chatDenyList.includes(String(uid))) {
			throw new Error('[[error:chat-restricted]]');
		}
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
	if (!utils.isNumber(roomId)) {
		throw new Error('[[error:invalid-data]]');
	}
	const [roomData, inRoom, canChat] = await Promise.all([
		Messaging.getRoomData(roomId),
		Messaging.isUserInRoom(uid, roomId),
		privileges.global.can(['chat', 'chat:privileged'], uid),
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
	if (!Array.isArray(mids) && (utils.isNumber(mids) || activitypub.helpers.isUri(mids))) {
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
