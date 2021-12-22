'use strict';

const validator = require('validator');

const db = require('../database');
const user = require('../user');
const plugins = require('../plugins');
const privileges = require('../privileges');
const meta = require('../meta');

module.exports = function (Messaging) {
	Messaging.getRoomData = async (roomId) => {
		const data = await db.getObject(`chat:room:${roomId}`);
		if (!data) {
			throw new Error('[[error:no-chat-room]]');
		}

		modifyRoomData([data]);
		return data;
	};

	Messaging.getRoomsData = async (roomIds) => {
		const roomData = await db.getObjects(roomIds.map(roomId => `chat:room:${roomId}`));
		modifyRoomData(roomData);
		return roomData;
	};

	function modifyRoomData(rooms) {
		rooms.forEach((data) => {
			if (data) {
				data.roomName = data.roomName || '';
				data.roomName = validator.escape(String(data.roomName));
				if (data.hasOwnProperty('groupChat')) {
					data.groupChat = parseInt(data.groupChat, 10) === 1;
				}
			}
		});
	}

	Messaging.newRoom = async (uid, toUids) => {
		const now = Date.now();
		const roomId = await db.incrObjectField('global', 'nextChatRoomId');
		const room = {
			owner: uid,
			roomId: roomId,
		};

		await Promise.all([
			db.setObject(`chat:room:${roomId}`, room),
			db.sortedSetAdd(`chat:room:${roomId}:uids`, now, uid),
		]);
		await Promise.all([
			Messaging.addUsersToRoom(uid, toUids, roomId),
			Messaging.addRoomToUsers(roomId, [uid].concat(toUids), now),
		]);
		// chat owner should also get the user-join system message
		await Messaging.addSystemMessage('user-join', uid, roomId);

		return roomId;
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
		const inRoom = await Messaging.isUserInRoom(uid, roomId);
		const payload = await plugins.hooks.fire('filter:messaging.addUsersToRoom', { uid, uids, roomId, inRoom });

		if (!payload.inRoom) {
			throw new Error('[[error:cant-add-users-to-chat-room]]');
		}

		const now = Date.now();
		const timestamps = payload.uids.map(() => now);
		await db.sortedSetAdd(`chat:room:${payload.roomId}:uids`, timestamps, payload.uids);
		await updateGroupChatField([payload.roomId]);
		await Promise.all(payload.uids.map(uid => Messaging.addSystemMessage('user-join', uid, payload.roomId)));
	};

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

	async function updateGroupChatField(roomIds) {
		const userCounts = await db.sortedSetsCard(roomIds.map(roomId => `chat:room:${roomId}:uids`));
		const groupChats = roomIds.filter((roomId, index) => userCounts[index] > 2);
		const privateChats = roomIds.filter((roomId, index) => userCounts[index] <= 2);
		await db.setObjectBulk([
			...groupChats.map(id => [`chat:room:${id}`, { groupChat: 1 }]),
			...privateChats.map(id => [`chat:room:${id}`, { groupChat: 0 }]),
		]);
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
		await updateGroupChatField([roomId]);
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
		await updateGroupChatField(roomIds);
	};

	async function updateOwner(roomId) {
		const uids = await db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, 0);
		const newOwner = uids[0] || 0;
		await db.setObjectField(`chat:room:${roomId}`, 'owner', newOwner);
	}

	Messaging.getUidsInRoom = async (roomId, start, stop) => db.getSortedSetRevRange(`chat:room:${roomId}:uids`, start, stop);

	Messaging.getUsersInRoom = async (roomId, start, stop) => {
		const uids = await Messaging.getUidsInRoom(roomId, start, stop);
		const [users, isOwners] = await Promise.all([
			user.getUsersFields(uids, ['uid', 'username', 'picture', 'status']),
			Messaging.isRoomOwner(uids, roomId),
		]);

		return users.map((user, index) => {
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
		const canChat = await privileges.global.can('chat', uid);
		if (!canChat) {
			throw new Error('[[error:no-privileges]]');
		}
		const inRoom = await Messaging.isUserInRoom(uid, data.roomId);
		if (!inRoom) {
			return null;
		}

		const [room, canReply, users, messages, isAdminOrGlobalMod] = await Promise.all([
			Messaging.getRoomData(data.roomId),
			Messaging.canReply(data.roomId, uid),
			Messaging.getUsersInRoom(data.roomId, 0, -1),
			Messaging.getMessages({
				callerUid: uid,
				uid: data.uid || uid,
				roomId: data.roomId,
				isNew: false,
			}),
			user.isAdminOrGlobalMod(uid),
		]);

		room.messages = messages;
		room.isOwner = await Messaging.isRoomOwner(uid, room.roomId);
		room.users = users.filter(user => user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== parseInt(uid, 10));
		room.canReply = canReply;
		room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : users.length > 2;
		room.usernames = Messaging.generateUsernames(users, uid);
		room.maximumUsersInChatRoom = meta.config.maximumUsersInChatRoom;
		room.maximumChatMessageLength = meta.config.maximumChatMessageLength;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
		room.isAdminOrGlobalMod = isAdminOrGlobalMod;

		const payload = await plugins.hooks.fire('filter:messaging.loadRoom', { uid, data, room });
		return payload.room;
	};
};
