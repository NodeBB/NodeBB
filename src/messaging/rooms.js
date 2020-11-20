'use strict';

var validator = require('validator');

var db = require('../database');
var user = require('../user');
var plugins = require('../plugins');
var privileges = require('../privileges');
var meta = require('../meta');

module.exports = function (Messaging) {
	Messaging.getRoomData = async (roomId) => {
		const data = await db.getObject('chat:room:' + roomId);
		if (!data) {
			throw new Error('[[error:no-chat-room]]');
		}

		modifyRoomData([data]);
		return data;
	};

	Messaging.getRoomsData = async (roomIds) => {
		const roomData = await db.getObjects(roomIds.map(roomId => 'chat:room:' + roomId));
		modifyRoomData(roomData);
		return roomData;
	};

	function modifyRoomData(rooms) {
		rooms.forEach(function (data) {
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
			db.setObject('chat:room:' + roomId, room),
			db.sortedSetAdd('chat:room:' + roomId + ':uids', now, uid),
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
		const inRoom = await db.isSortedSetMember('chat:room:' + roomId + ':uids', uid);
		const data = await plugins.fireHook('filter:messaging.isUserInRoom', { uid: uid, roomId: roomId, inRoom: inRoom });
		return data.inRoom;
	};

	Messaging.roomExists = async roomId => db.exists('chat:room:' + roomId + ':uids');

	Messaging.getUserCountInRoom = async roomId => db.sortedSetCard('chat:room:' + roomId + ':uids');

	Messaging.isRoomOwner = async (uid, roomId) => {
		const owner = await db.getObjectField('chat:room:' + roomId, 'owner');
		return parseInt(uid, 10) === parseInt(owner, 10);
	};

	Messaging.addUsersToRoom = async function (uid, uids, roomId) {
		const now = Date.now();
		const timestamps = uids.map(() => now);
		const inRoom = await Messaging.isUserInRoom(uid, roomId);
		if (!inRoom) {
			throw new Error('[[error:cant-add-users-to-chat-room]]');
		}

		await db.sortedSetAdd('chat:room:' + roomId + ':uids', timestamps, uids);
		await updateGroupChatField([roomId]);
		await Promise.all(uids.map(uid => Messaging.addSystemMessage('user-join', uid, roomId)));
	};

	Messaging.removeUsersFromRoom = async (uid, uids, roomId) => {
		const [isOwner, userCount] = await Promise.all([
			Messaging.isRoomOwner(uid, roomId),
			Messaging.getUserCountInRoom(roomId),
		]);

		if (!isOwner) {
			throw new Error('[[error:cant-remove-users-from-chat-room]]');
		}
		if (userCount === 2) {
			throw new Error('[[error:cant-remove-last-user]]');
		}

		await Messaging.leaveRoom(uids, roomId);
	};

	Messaging.isGroupChat = async function (roomId) {
		return (await Messaging.getRoomData(roomId)).groupChat;
	};

	async function updateGroupChatField(roomIds) {
		const userCounts = await db.sortedSetsCard(roomIds.map(roomId => 'chat:room:' + roomId + ':uids'));
		const groupChats = roomIds.filter((roomId, index) => userCounts[index] > 2);
		const privateChats = roomIds.filter((roomId, index) => userCounts[index] <= 2);
		await Promise.all([
			db.setObjectField(groupChats.map(id => 'chat:room:' + id, 'groupChat', 1)),
			db.setObjectField(privateChats.map(id => 'chat:room:' + id, 'groupChat', 0)),
		]);
	}

	Messaging.leaveRoom = async (uids, roomId) => {
		const isInRoom = await Promise.all(uids.map(uid => Messaging.isUserInRoom(uid, roomId)));
		uids = uids.filter((uid, index) => isInRoom[index]);

		const keys = uids
			.map(uid => 'uid:' + uid + ':chat:rooms')
			.concat(uids.map(uid => 'uid:' + uid + ':chat:rooms:unread'));

		await Promise.all([
			db.sortedSetRemove('chat:room:' + roomId + ':uids', uids),
			db.sortedSetsRemove(keys, roomId),
		]);

		await Promise.all(uids.map(uid => Messaging.addSystemMessage('user-leave', uid, roomId)));
		await updateOwner(roomId);
		await updateGroupChatField([roomId]);
	};

	Messaging.leaveRooms = async (uid, roomIds) => {
		const isInRoom = await Promise.all(roomIds.map(roomId => Messaging.isUserInRoom(uid, roomId)));
		roomIds = roomIds.filter((roomId, index) => isInRoom[index]);

		const roomKeys = roomIds.map(roomId => 'chat:room:' + roomId + ':uids');
		await Promise.all([
			db.sortedSetsRemove(roomKeys, uid),
			db.sortedSetRemove([
				'uid:' + uid + ':chat:rooms',
				'uid:' + uid + ':chat:rooms:unread',
			], roomIds),
		]);

		await Promise.all(
			roomIds.map(roomId => updateOwner(roomId))
				.concat(roomIds.map(roomId => Messaging.addSystemMessage('user-leave', uid, roomId)))
		);
		await updateGroupChatField(roomIds);
	};

	async function updateOwner(roomId) {
		const uids = await db.getSortedSetRange('chat:room:' + roomId + ':uids', 0, 0);
		const newOwner = uids[0] || 0;
		await db.setObjectField('chat:room:' + roomId, 'owner', newOwner);
	}

	Messaging.getUidsInRoom = async (roomId, start, stop) => db.getSortedSetRevRange('chat:room:' + roomId + ':uids', start, stop);

	Messaging.getUsersInRoom = async (roomId, start, stop) => {
		const uids = await Messaging.getUidsInRoom(roomId, start, stop);
		const [users, ownerId] = await Promise.all([
			user.getUsersFields(uids, ['uid', 'username', 'picture', 'status']),
			db.getObjectField('chat:room:' + roomId, 'owner'),
		]);

		return users.map(function (user) {
			user.isOwner = parseInt(user.uid, 10) === parseInt(ownerId, 10);
			return user;
		});
	};

	Messaging.renameRoom = async function (uid, roomId, newName) {
		if (!newName) {
			throw new Error('[[error:invalid-name]]');
		}
		newName = newName.trim();
		if (newName.length > 75) {
			throw new Error('[[error:chat-room-name-too-long]]');
		}

		const payload = await plugins.fireHook('filter:chat.renameRoom', {
			uid: uid,
			roomId: roomId,
			newName: newName,
		});
		const isOwner = await Messaging.isRoomOwner(payload.uid, payload.roomId);
		if (!isOwner) {
			throw new Error('[[error:no-privileges]]');
		}

		await db.setObjectField('chat:room:' + payload.roomId, 'roomName', payload.newName);
		await Messaging.addSystemMessage('room-rename, ' + payload.newName.replace(',', '&#44;'), payload.uid, payload.roomId);

		plugins.fireHook('action:chat.renameRoom', {
			roomId: payload.roomId,
			newName: payload.newName,
		});
	};

	Messaging.canReply = async (roomId, uid) => {
		const inRoom = await db.isSortedSetMember('chat:room:' + roomId + ':uids', uid);
		const data = await plugins.fireHook('filter:messaging.canReply', { uid: uid, roomId: roomId, inRoom: inRoom, canReply: inRoom });
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

		const [roomData, canReply, users, messages, isAdminOrGlobalMod] = await Promise.all([
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

		var room = roomData;
		room.messages = messages;
		room.isOwner = parseInt(room.owner, 10) === parseInt(uid, 10);
		room.users = users.filter(function (user) {
			return user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== parseInt(uid, 10);
		});
		room.canReply = canReply;
		room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : users.length > 2;
		room.usernames = Messaging.generateUsernames(users, uid);
		room.maximumUsersInChatRoom = meta.config.maximumUsersInChatRoom;
		room.maximumChatMessageLength = meta.config.maximumChatMessageLength;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
		room.isAdminOrGlobalMod = isAdminOrGlobalMod;

		return room;
	};
};
