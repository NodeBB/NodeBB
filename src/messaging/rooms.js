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
const io = require('../socket.io');
const cache = require('../cache');
const cacheCreate = require('../cacheCreate');

const roomUidCache = cacheCreate({
	name: 'chat:room:uids',
	max: 500,
	ttl: 0,
});

const intFields = [
	'roomId', 'timestamp', 'userCount', 'messageCount',
];

module.exports = function (Messaging) {
	Messaging.getRoomData = async (roomId, fields = []) => {
		const roomData = await Messaging.getRoomsData([roomId], fields);
		return roomData[0];
	};

	Messaging.getRoomsData = async (roomIds, fields = []) => {
		if (fields.includes('notificationSetting') && !fields.includes('public')) {
			fields.push('public');
		}
		const roomData = await db.getObjects(
			roomIds.map(roomId => `chat:room:${roomId}`),
			fields
		);
		modifyRoomData(roomData, fields);
		return roomData;
	};

	function modifyRoomData(rooms, fields) {
		rooms.forEach((data) => {
			if (data) {
				db.parseIntFields(data, intFields, fields);
				data.roomName = validator.escape(String(data.roomName || ''));
				data.public = parseInt(data.public, 10) === 1;
				data.groupChat = data.userCount > 2;

				if (!fields.length || fields.includes('notificationSetting')) {
					data.notificationSetting = data.notificationSetting ||
						(
							data.public ?
								Messaging.notificationSettings.ATMENTION :
								Messaging.notificationSettings.ALLMESSAGES
						);
				}

				if (data.hasOwnProperty('groups') || !fields.length || fields.includes('groups')) {
					try {
						data.groups = JSON.parse(data.groups || '[]');
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
		if (data.hasOwnProperty('roomName')) {
			checkRoomName(data.roomName);
		}

		const now = Date.now();
		const roomId = await db.incrObjectField('global', 'nextChatRoomId');
		const room = {
			roomId: roomId,
			timestamp: now,
			notificationSetting: data.notificationSetting,
			messageCount: 0,
		};

		if (data.hasOwnProperty('roomName') && data.roomName) {
			room.roomName = String(data.roomName).trim();
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
			db.sortedSetAdd(`chat:room:${roomId}:owners`, now, uid),
			db.sortedSetsAdd([
				`chat:room:${roomId}:uids`,
				`chat:room:${roomId}:uids:online`,
			], now, uid),
		]);

		await Promise.all([
			Messaging.addUsersToRoom(uid, data.uids, roomId),
			isPublic ?
				db.sortedSetAddBulk([
					['chat:rooms:public', now, roomId],
					['chat:rooms:public:order', roomId, roomId],
				]) :
				Messaging.addRoomToUsers(roomId, [uid].concat(data.uids), now),
		]);

		cache.del([
			'chat:rooms:public:all',
			'chat:rooms:public:order:all',
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

			await db.sortedSetsRemove(keys, roomId);
		}));
		await Promise.all([
			db.deleteAll([
				...roomIds.map(id => `chat:room:${id}`),
				...roomIds.map(id => `chat:room:${id}:uids`),
				...roomIds.map(id => `chat:room:${id}:owners`),
				...roomIds.map(id => `chat:room:${id}:uids:online`),
				...roomIds.map(id => `chat:room:${id}:notification:settings`),
			]),
			db.sortedSetRemove([
				'chat:rooms',
				'chat:rooms:public',
				'chat:rooms:public:order',
				'chat:rooms:public:lastpost',
			], roomIds),
		]);
		cache.del([
			'chat:rooms:public:all',
			'chat:rooms:public:order:all',
		]);
	};

	Messaging.isUserInRoom = async (uid, roomIds) => {
		let single = false;
		if (!Array.isArray(roomIds)) {
			roomIds = [roomIds];
			single = true;
		}
		const inRooms = await db.isMemberOfSortedSets(
			roomIds.map(id => `chat:room:${id}:uids`),
			uid
		);

		const data = await Promise.all(roomIds.map(async (roomId, idx) => {
			const data = await plugins.hooks.fire('filter:messaging.isUserInRoom', {
				uid: uid,
				roomId: roomId,
				inRoom: inRooms[idx],
			});
			return data.inRoom;
		}));
		return single ? data.pop() : data;
	};

	Messaging.isUsersInRoom = async (uids, roomId) => {
		let single = false;
		if (!Array.isArray(uids)) {
			uids = [uids];
			single = true;
		}

		const inRooms = await db.isSortedSetMembers(
			`chat:room:${roomId}:uids`,
			uids,
		);

		const data = await plugins.hooks.fire('filter:messaging.isUsersInRoom', {
			uids: uids,
			roomId: roomId,
			inRooms: inRooms,
		});

		return single ? data.inRooms.pop() : data.inRooms;
	};

	Messaging.roomExists = async roomId => db.exists(`chat:room:${roomId}`);

	Messaging.getUserCountInRoom = async roomId => db.sortedSetCard(`chat:room:${roomId}:uids`);

	Messaging.isRoomOwner = async (uids, roomId) => {
		const isArray = Array.isArray(uids);
		if (!isArray) {
			uids = [uids];
		}

		const isOwners = await db.isSortedSetMembers(`chat:room:${roomId}:owners`, uids);
		const result = await Promise.all(isOwners.map(async (isOwner, index) => {
			const payload = await plugins.hooks.fire('filter:messaging.isRoomOwner', { uid: uids[index], roomId, isOwner });
			return payload.isOwner;
		}));
		return isArray ? result : result[0];
	};

	Messaging.toggleOwner = async (uid, roomId, state = null) => {
		if (!(parseInt(uid, 10) > 0) || !roomId) {
			throw new Error('[[error:invalid-data]]');
		}

		const isOwner = await Messaging.isRoomOwner(uid, roomId);
		if (state !== null) {
			if (state === isOwner) {
				return false;
			}
		} else {
			state = !isOwner;
		}

		if (state) {
			await db.sortedSetAdd(`chat:room:${roomId}:owners`, Date.now(), uid);
		} else {
			await db.sortedSetRemove(`chat:room:${roomId}:owners`, uid);
		}
	};

	Messaging.isRoomPublic = async function (roomId) {
		return parseInt(await db.getObjectField(`chat:room:${roomId}`, 'public'), 10) === 1;
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
		await Promise.all([
			db.sortedSetAdd(`chat:room:${roomId}:uids`, timestamps, uids),
			db.sortedSetAdd(`chat:room:${roomId}:uids:online`, timestamps, uids),
		]);
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
		roomUidCache.del(roomIds.map(id => `chat:room:${id}:users`));
	}

	Messaging.leaveRoom = async (uids, roomId) => {
		const isInRoom = await Promise.all(uids.map(uid => Messaging.isUserInRoom(uid, roomId)));
		uids = uids.filter((uid, index) => isInRoom[index]);

		const keys = uids
			.map(uid => `uid:${uid}:chat:rooms`)
			.concat(uids.map(uid => `uid:${uid}:chat:rooms:unread`));

		await Promise.all([
			db.sortedSetRemove([
				`chat:room:${roomId}:uids`,
				`chat:room:${roomId}:owners`,
				`chat:room:${roomId}:uids:online`,
			], uids),
			db.sortedSetsRemove(keys, roomId),
		]);

		await Promise.all(uids.map(uid => Messaging.addSystemMessage('user-leave', uid, roomId)));
		await updateOwner(roomId);
		await updateUserCount([roomId]);
	};

	Messaging.leaveRooms = async (uid, roomIds) => {
		const isInRoom = await Promise.all(roomIds.map(roomId => Messaging.isUserInRoom(uid, roomId)));
		roomIds = roomIds.filter((roomId, index) => isInRoom[index]);

		const roomKeys = [
			...roomIds.map(roomId => `chat:room:${roomId}:uids`),
			...roomIds.map(roomId => `chat:room:${roomId}:owners`),
			...roomIds.map(roomId => `chat:room:${roomId}:uids:online`),
		];
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
		let nextOwner = await db.getSortedSetRange(`chat:room:${roomId}:owners`, 0, 0);
		if (!nextOwner.length) {
			// no owners left grab next user
			nextOwner = await db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, 0);
			const newOwner = nextOwner[0] || 0;
			if (parseInt(newOwner, 10) > 0) {
				await db.sortedSetAdd(`chat:room:${roomId}:owners`, Date.now(), newOwner);
			}
		}
	}

	Messaging.getAllUidsInRoomFromSet = async function (set) {
		const cacheKey = `${set}:all`;
		let uids = roomUidCache.get(cacheKey);
		if (uids !== undefined) {
			return uids;
		}
		uids = await Messaging.getUidsInRoomFromSet(set, 0, -1);
		roomUidCache.set(cacheKey, uids);
		return uids;
	};

	Messaging.getUidsInRoomFromSet = async (set, start, stop, reverse = false) => db[
		reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'
	](set, start, stop);

	Messaging.getUidsInRoom = async (roomId, start, stop, reverse = false) => db[
		reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'
	](`chat:room:${roomId}:uids`, start, stop);

	Messaging.getUsersInRoom = async (roomId, start, stop, reverse = false) => {
		const users = await Messaging.getUsersInRoomFromSet(
			`chat:room:${roomId}:uids`, roomId, start, stop, reverse
		);
		return users;
	};

	Messaging.getUsersInRoomFromSet = async (set, roomId, start, stop, reverse = false) => {
		const uids = await Messaging.getUidsInRoomFromSet(set, start, stop, reverse);
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
		newName = String(newName).trim();
		checkRoomName(newName);

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

	function checkRoomName(roomName) {
		if (!roomName && roomName !== '') {
			throw new Error('[[error:invalid-room-name]]');
		}
		if (roomName.length > meta.config.maximumChatRoomNameLength) {
			throw new Error(`[[error:chat-room-name-too-long, ${meta.config.maximumChatRoomNameLength}]]`);
		}
	}

	Messaging.canReply = async (roomId, uid) => {
		const inRoom = await db.isSortedSetMember(`chat:room:${roomId}:uids`, uid);
		const data = await plugins.hooks.fire('filter:messaging.canReply', { uid: uid, roomId: roomId, inRoom: inRoom, canReply: inRoom });
		return data.canReply;
	};

	Messaging.loadRoom = async (uid, data) => {
		const { roomId } = data;
		const [room, inRoom, canChat, isAdmin, isGlobalMod] = await Promise.all([
			Messaging.getRoomData(roomId),
			Messaging.isUserInRoom(uid, roomId),
			privileges.global.can(['chat', 'chat:privileged'], uid),
			user.isAdministrator(uid),
			user.isGlobalModerator(uid),
		]);

		if (!room ||
			(!room.public && !inRoom) ||
			(room.public && (
				Array.isArray(room.groups) && room.groups.length && !isAdmin && !(await groups.isMemberOfAny(uid, room.groups)))
			)
		) {
			return null;
		}
		if (!canChat.includes(true)) {
			throw new Error('[[error:no-privileges]]');
		}

		// add user to public room onload
		if (room.public && !inRoom) {
			await addUidsToRoom([uid], roomId);
			room.userCount += 1;
		} else if (inRoom) {
			await db.sortedSetAdd(`chat:room:${roomId}:uids:online`, Date.now(), uid);
		}

		async function getNotificationOptions() {
			const userSetting = await db.getObjectField(`chat:room:${roomId}:notification:settings`, uid);
			const roomDefault = room.notificationSetting;
			const currentSetting = userSetting || roomDefault;
			const labels = {
				[Messaging.notificationSettings.NONE]: { label: '[[modules:chat.notification-setting-none]]', icon: 'fa-ban' },
				[Messaging.notificationSettings.ATMENTION]: { label: '[[modules:chat.notification-setting-at-mention-only]]', icon: 'fa-at' },
				[Messaging.notificationSettings.ALLMESSAGES]: { label: '[[modules:chat.notification-setting-all-messages]]', icon: 'fa-comment-o' },
			};
			const options = [
				{
					label: '[[modules:chat.notification-setting-room-default]]',
					subLabel: labels[roomDefault].label || '',
					icon: labels[roomDefault].icon,
					value: -1,
					selected: userSetting === null,
				},
			];
			Object.keys(labels).forEach((key) => {
				options.push({
					label: labels[key].label,
					icon: labels[key].icon,
					value: key,
					selected: parseInt(userSetting, 10) === parseInt(key, 10),
				});
			});
			return { options, selectedIcon: labels[currentSetting].icon };
		}

		const [canReply, users, messages, settings, isOwner, onlineUids, notifOptions] = await Promise.all([
			Messaging.canReply(roomId, uid),
			Messaging.getUsersInRoomFromSet(`chat:room:${roomId}:uids:online`, roomId, 0, 39, true),
			Messaging.getMessages({
				callerUid: uid,
				start: data.start || 0,
				uid: data.uid || uid,
				roomId: roomId,
				isNew: false,
			}),
			user.getSettings(uid),
			Messaging.isRoomOwner(uid, roomId),
			io.getUidsInRoom(`chat_room_${roomId}`),
			getNotificationOptions(),
			Messaging.markRoomNotificationsRead(uid, roomId),
		]);

		users.forEach((user) => {
			if (user) {
				user.online = parseInt(user.uid, 10) === parseInt(uid, 10) || onlineUids.includes(String(user.uid));
			}
		});

		room.messages = messages;
		room.isOwner = isOwner;
		room.users = users;
		room.canReply = canReply;
		room.groupChat = users.length > 2;
		room.icon = Messaging.getRoomIcon(room);
		room.usernames = Messaging.generateUsernames(room, uid);
		room.chatWithMessage = await Messaging.generateChatWithMessage(room, uid, settings.userLang);
		room.maximumUsersInChatRoom = meta.config.maximumUsersInChatRoom;
		room.maximumChatMessageLength = meta.config.maximumChatMessageLength;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
		room.isAdminOrGlobalMod = isAdmin || isGlobalMod;
		room.isAdmin = isAdmin;
		room.notificationOptions = notifOptions.options;
		room.notificationOptionsIcon = notifOptions.selectedIcon;
		room.composerActions = [];

		const payload = await plugins.hooks.fire('filter:messaging.loadRoom', { uid, data, room });
		return payload.room;
	};

	const globalUserGroups = [
		'registered-users', 'verified-users', 'unverified-users', 'banned-users',
	];

	Messaging.getRoomIcon = function (roomData) {
		const hasGroups = Array.isArray(roomData.groups) && roomData.groups.length;
		return !hasGroups || roomData.groups.some(group => globalUserGroups.includes(group)) ? 'fa-hashtag' : 'fa-lock';
	};
};
