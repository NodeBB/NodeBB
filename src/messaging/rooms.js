'use strict';

const _ = require('lodash');
const validator = require('validator');
const winston = require('winston');

const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const plugins = require('../plugins');
const privileges = require('../privileges');
const meta = require('../meta');
const cacheCreate = require('../cacheCreate');

const cache = cacheCreate({
	name: 'chat:room:uids',
	max: 500,
	ttl: 0,
});

module.exports = function (Messaging) {
	Messaging.getRoomData = async (roomId, fields = []) => {
		const data = await db.getObject(`chat:room:${roomId}`, fields);
		if (!data) {
			throw new Error('[[error:no-chat-room]]');
		}

		modifyRoomData([data]);
		return data;
	};

	Messaging.getRoomsData = async (roomIds, fields = []) => {
		const roomData = await db.getObjects(
			roomIds.map(roomId => `chat:room:${roomId}`),
			fields
		);
		modifyRoomData(roomData);
		return roomData;
	};

	function modifyRoomData(rooms) {
		rooms.forEach((data) => {
			if (data) {
				data.roomName = validator.escape(String(data.roomName || ''));
				data.public = parseInt(data.public, 10) === 1;
				if (data.hasOwnProperty('groupChat')) {
					data.groupChat = parseInt(data.groupChat, 10) === 1;
				}
				if (data.hasOwnProperty('userCount')) {
					data.userCount = parseInt(data.userCount, 10) || 0;
				}
				if (data.hasOwnProperty('groups')) {
					try {
						data.groups = JSON.parse(data.groups);
					} catch (err) {
						winston.error(err.stack);
						data.groups = [];
					}
				}
			}
		});
	}

	Messaging.newRoom = async (uid, data) => {
		// backwards compat. remove in 4.x
		if (Array.isArray(data)) { // old usage second param used to be toUids
			data = { uids: data };
		}
		const now = Date.now();
		const roomId = await db.incrObjectField('global', 'nextChatRoomId');
		const room = {
			owner: uid,
			roomId: roomId,
		};

		if (data.hasOwnProperty('roomName') && data.roomName) {
			room.roomName = String(data.roomName);
		}
		if (Array.isArray(data.groups) && data.groups.length) {
			room.groups = JSON.stringify(data.groups);
		}
		const isPublic = data.type === 'public';
		if (isPublic) {
			room.public = 1;
		}

		await Promise.all([
			db.setObject(`chat:room:${roomId}`, room),
			db.sortedSetAdd('chat:rooms', now, roomId),
			db.sortedSetAdd(`chat:room:${roomId}:uids`, now, uid),
		]);

		await Promise.all([
			Messaging.addUsersToRoom(uid, data.uids, roomId),
			isPublic ?
				db.sortedSetAdd('chat:rooms:public', now, roomId) :
				Messaging.addRoomToUsers(roomId, [uid].concat(data.uids), now),
		]);

		if (!isPublic) {
			// chat owner should also get the user-join system message
			await Messaging.addSystemMessage('user-join', uid, roomId);
		}

		return roomId;
	};

	Messaging.deleteRooms = async (roomIds) => {
		if (!roomIds) {
			throw new Error('[[error:invalid-data]]');
		}

		if (!Array.isArray(roomIds)) {
			roomIds = [roomIds];
		}

		await Promise.all(roomIds.map(async (roomId) => {
			const uids = await db.getSortedSetMembers(`chat:room:${roomId}:uids`);
			const keys = uids
				.map(uid => `uid:${uid}:chat:rooms`)
				.concat(uids.map(uid => `uid:${uid}:chat:rooms:unread`));

			await Promise.all([
				db.sortedSetRemove(`chat:room:${roomId}:uids`, uids),
				db.sortedSetsRemove(keys, roomId),
			]);
		}));
		await Promise.all([
			db.deleteAll(roomIds.map(id => `chat:room:${id}`)),
			db.sortedSetRemove('chat:rooms', roomIds),
			db.sortedSetRemove('chat:rooms:public', roomIds),
		]);
	};

	Messaging.isUserInRoom = async (uid, roomId) => {
		const inRoom = await db.isSortedSetMember(`chat:room:${roomId}:uids`, uid);
		const data = await plugins.hooks.fire('filter:messaging.isUserInRoom', { uid: uid, roomId: roomId, inRoom: inRoom });
		return data.inRoom;
	};

	Messaging.roomExists = async roomId => db.exists(`chat:room:${roomId}:uids`);

	Messaging.getUserCountInRoom = async roomId => db.sortedSetCard(`chat:room:${roomId}:uids`);

	Messaging.isRoomOwner = async (uids, roomId) => {
		const isArray = Array.isArray(uids);
		if (!isArray) {
			uids = [uids];
		}
		const owner = await db.getObjectField(`chat:room:${roomId}`, 'owner');
		const isOwners = uids.map(uid => parseInt(uid, 10) === parseInt(owner, 10));

		const result = await Promise.all(isOwners.map(async (isOwner, index) => {
			const payload = await plugins.hooks.fire('filter:messaging.isRoomOwner', { uid: uids[index], roomId, owner, isOwner });
			return payload.isOwner;
		}));
		return isArray ? result : result[0];
	};

	Messaging.addUsersToRoom = async function (uid, uids, roomId) {
		uids = _.uniq(uids);
		const inRoom = await Messaging.isUserInRoom(uid, roomId);
		const payload = await plugins.hooks.fire('filter:messaging.addUsersToRoom', { uid, uids, roomId, inRoom });

		if (!payload.inRoom) {
			throw new Error('[[error:cant-add-users-to-chat-room]]');
		}

		await addUidsToRoom(payload.uids, roomId);
	};

	async function addUidsToRoom(uids, roomId) {
		const now = Date.now();
		const timestamps = uids.map(() => now);
		await db.sortedSetAdd(`chat:room:${roomId}:uids`, timestamps, uids);
		await updateUserCount([roomId]);
		await Promise.all(uids.map(uid => Messaging.addSystemMessage('user-join', uid, roomId)));
	}

	Messaging.removeUsersFromRoom = async (uid, uids, roomId) => {
		const [isOwner, userCount] = await Promise.all([
			Messaging.isRoomOwner(uid, roomId),
			Messaging.getUserCountInRoom(roomId),
		]);
		const payload = await plugins.hooks.fire('filter:messaging.removeUsersFromRoom', { uid, uids, roomId, isOwner, userCount });

		if (!payload.isOwner) {
			throw new Error('[[error:cant-remove-users-from-chat-room]]');
		}

		await Messaging.leaveRoom(payload.uids, payload.roomId);
	};

	Messaging.isGroupChat = async function (roomId) {
		return (await Messaging.getRoomData(roomId)).groupChat;
	};

	async function updateUserCount(roomIds) {
		const userCounts = await db.sortedSetsCard(roomIds.map(roomId => `chat:room:${roomId}:uids`));
		const countMap = _.zipObject(roomIds, userCounts);
		const groupChats = roomIds.filter((roomId, index) => userCounts[index] > 2);
		const privateChats = roomIds.filter((roomId, index) => userCounts[index] <= 2);
		await db.setObjectBulk([
			...groupChats.map(id => [`chat:room:${id}`, { groupChat: 1, userCount: countMap[id] }]),
			...privateChats.map(id => [`chat:room:${id}`, { groupChat: 0, userCount: countMap[id] }]),
		]);
		cache.del(roomIds.map(id => `chat:room:${id}:users`));
	}

	Messaging.leaveRoom = async (uids, roomId) => {
		const isInRoom = await Promise.all(uids.map(uid => Messaging.isUserInRoom(uid, roomId)));
		uids = uids.filter((uid, index) => isInRoom[index]);

		const keys = uids
			.map(uid => `uid:${uid}:chat:rooms`)
			.concat(uids.map(uid => `uid:${uid}:chat:rooms:unread`));

		await Promise.all([
			db.sortedSetRemove(`chat:room:${roomId}:uids`, uids),
			db.sortedSetsRemove(keys, roomId),
		]);

		await Promise.all(uids.map(uid => Messaging.addSystemMessage('user-leave', uid, roomId)));
		await updateOwner(roomId);
		await updateUserCount([roomId]);
	};

	Messaging.leaveRooms = async (uid, roomIds) => {
		const isInRoom = await Promise.all(roomIds.map(roomId => Messaging.isUserInRoom(uid, roomId)));
		roomIds = roomIds.filter((roomId, index) => isInRoom[index]);

		const roomKeys = roomIds.map(roomId => `chat:room:${roomId}:uids`);
		await Promise.all([
			db.sortedSetsRemove(roomKeys, uid),
			db.sortedSetRemove([
				`uid:${uid}:chat:rooms`,
				`uid:${uid}:chat:rooms:unread`,
			], roomIds),
		]);

		await Promise.all(
			roomIds.map(roomId => updateOwner(roomId))
				.concat(roomIds.map(roomId => Messaging.addSystemMessage('user-leave', uid, roomId)))
		);
		await updateUserCount(roomIds);
	};

	async function updateOwner(roomId) {
		const uids = await db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, 0);
		const newOwner = uids[0] || 0;
		await db.setObjectField(`chat:room:${roomId}`, 'owner', newOwner);
	}

	Messaging.getAllUidsInRoom = async function (roomId) {
		const cacheKey = `chat:room:${roomId}:users`;
		let uids = cache.get(cacheKey);
		if (uids !== undefined) {
			return uids;
		}
		uids = await Messaging.getUidsInRoom(roomId, 0, -1);
		cache.set(cacheKey, uids);
		return uids;
	};

	Messaging.getUidsInRoom = async (roomId, start, stop) => db.getSortedSetRange(`chat:room:${roomId}:uids`, start, stop);

	Messaging.getUsersInRoom = async (roomId, start, stop) => {
		const uids = await Messaging.getUidsInRoom(roomId, start, stop);
		const [users, isOwners] = await Promise.all([
			user.getUsersFields(uids, ['uid', 'username', 'picture', 'status']),
			Messaging.isRoomOwner(uids, roomId),
		]);

		return users.map((user, index) => {
			user.index = start + index;
			user.isOwner = isOwners[index];
			return user;
		});
	};

	Messaging.renameRoom = async function (uid, roomId, newName) {
		if (!newName) {
			throw new Error('[[error:invalid-data]]');
		}
		newName = newName.trim();
		if (newName.length > 75) {
			throw new Error('[[error:chat-room-name-too-long]]');
		}

		const payload = await plugins.hooks.fire('filter:chat.renameRoom', {
			uid: uid,
			roomId: roomId,
			newName: newName,
		});
		const isOwner = await Messaging.isRoomOwner(payload.uid, payload.roomId);
		if (!isOwner) {
			throw new Error('[[error:no-privileges]]');
		}

		await db.setObjectField(`chat:room:${payload.roomId}`, 'roomName', payload.newName);
		await Messaging.addSystemMessage(`room-rename, ${payload.newName.replace(',', '&#44;')}`, payload.uid, payload.roomId);

		plugins.hooks.fire('action:chat.renameRoom', {
			roomId: payload.roomId,
			newName: payload.newName,
		});
	};

	Messaging.canReply = async (roomId, uid) => {
		const inRoom = await db.isSortedSetMember(`chat:room:${roomId}:uids`, uid);
		const data = await plugins.hooks.fire('filter:messaging.canReply', { uid: uid, roomId: roomId, inRoom: inRoom, canReply: inRoom });
		return data.canReply;
	};

	Messaging.loadRoom = async (uid, data) => {
		const { roomId } = data;
		const [room, inRoom, canChat] = await Promise.all([
			Messaging.getRoomData(roomId),
			Messaging.isUserInRoom(uid, roomId),
			privileges.global.can('chat', uid),
		]);

		if (!canChat) {
			throw new Error('[[error:no-privileges]]');
		}
		if (!room ||
			(!room.public && !inRoom) ||
			(room.public && !(await groups.isMemberOfAny(uid, room.groups)))
		) {
			return null;
		}

		// add user to public room onload
		if (room.public && !inRoom) {
			await addUidsToRoom([uid], roomId);
		}

		const [canReply, users, messages, isAdmin, isGlobalMod, settings, isOwner] = await Promise.all([
			Messaging.canReply(roomId, uid),
			Messaging.getUsersInRoom(roomId, 0, 39),
			Messaging.getMessages({
				callerUid: uid,
				uid: data.uid || uid,
				roomId: roomId,
				isNew: false,
			}),
			user.isAdministrator(uid),
			user.isGlobalModerator(uid),
			user.getSettings(uid),
			Messaging.isRoomOwner(uid, roomId),
		]);

		room.messages = messages;
		room.isOwner = isOwner;
		room.users = users.filter(user => user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== parseInt(uid, 10));
		room.canReply = canReply;
		room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : users.length > 2;
		room.usernames = Messaging.generateUsernames(users, uid);
		room.chatWithMessage = await Messaging.generateChatWithMessage(users, uid, settings.userLang);
		room.maximumUsersInChatRoom = meta.config.maximumUsersInChatRoom;
		room.maximumChatMessageLength = meta.config.maximumChatMessageLength;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
		room.isAdminOrGlobalMod = isAdmin || isGlobalMod;
		room.isAdmin = isAdmin;

		const payload = await plugins.hooks.fire('filter:messaging.loadRoom', { uid, data, room });
		return payload.room;
	};
};
