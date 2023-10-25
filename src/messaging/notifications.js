'use strict';

const winston = require('winston');

const batch = require('../batch');
const db = require('../database');
const notifications = require('../notifications');
const user = require('../user');
const io = require('../socket.io');
const plugins = require('../plugins');

module.exports = function (Messaging) {
	Messaging.setUserNotificationSetting = async (uid, roomId, value) => {
		if (parseInt(value, 10) === -1) {
			// go back to default
			return await db.deleteObjectField(`chat:room:${roomId}:notification:settings`, uid);
		}
		await db.setObjectField(`chat:room:${roomId}:notification:settings`, uid, parseInt(value, 10));
	};

	Messaging.getUidsNotificationSetting = async (uids, roomId) => {
		const [settings, roomData] = await Promise.all([
			db.getObjectFields(`chat:room:${roomId}:notification:settings`, uids),
			Messaging.getRoomData(roomId, ['notificationSetting']),
		]);
		return uids.map(uid => parseInt(settings[uid] || roomData.notificationSetting, 10));
	};

	Messaging.markRoomNotificationsRead = async (uid, roomId) => {
		const chatNids = await db.getSortedSetScan({
			key: `uid:${uid}:notifications:unread`,
			match: `chat_${roomId}_*`,
		});
		if (chatNids.length) {
			await notifications.markReadMultiple(chatNids, uid);
			await user.notifications.pushCount(uid);
		}
	};

	Messaging.notifyUsersInRoom = async (fromUid, roomId, messageObj) => {
		const isPublic = parseInt(await db.getObjectField(`chat:room:${roomId}`, 'public'), 10) === 1;

		let data = {
			roomId: roomId,
			fromUid: fromUid,
			message: messageObj,
			public: isPublic,
		};
		data = await plugins.hooks.fire('filter:messaging.notify', data);
		if (!data) {
			return;
		}

		// delivers full message to all online users in roomId
		io.in(`chat_room_${roomId}`).emit('event:chats.receive', data);

		const unreadData = { roomId, fromUid, public: isPublic };
		if (isPublic && !messageObj.system) {
			// delivers unread public msg to all online users on the chats page
			io.in(`chat_room_public_${roomId}`).emit('event:chats.public.unread', unreadData);
		}
		if (messageObj.system) {
			return;
		}

		// push unread count only for private rooms
		if (!isPublic) {
			const uids = await Messaging.getAllUidsInRoomFromSet(`chat:room:${roomId}:uids:online`);
			Messaging.pushUnreadCount(uids, unreadData);
		}

		try {
			await sendNotification(fromUid, roomId, messageObj);
		} catch (err) {
			winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
		}
	};

	async function sendNotification(fromUid, roomId, messageObj) {
		fromUid = parseInt(fromUid, 10);

		const [settings, roomData, realtimeUids] = await Promise.all([
			db.getObject(`chat:room:${roomId}:notification:settings`),
			Messaging.getRoomData(roomId),
			io.getUidsInRoom(`chat_room_${roomId}`),
		]);
		const roomDefault = roomData.notificationSetting;
		const uidsToNotify = [];
		const { ALLMESSAGES } = Messaging.notificationSettings;
		await batch.processSortedSet(`chat:room:${roomId}:uids:online`, async (uids) => {
			uids = uids.filter(
				uid => (parseInt((settings && settings[uid]) || roomDefault, 10) === ALLMESSAGES) &&
					fromUid !== parseInt(uid, 10) &&
					!realtimeUids.includes(parseInt(uid, 10))
			);
			const hasRead = await Messaging.hasRead(uids, roomId);
			uidsToNotify.push(...uids.filter((uid, index) => !hasRead[index]));
		}, {
			reverse: true,
			batch: 500,
			interval: 100,
		});

		if (uidsToNotify.length) {
			const { displayname } = messageObj.fromUser;
			const isGroupChat = await Messaging.isGroupChat(roomId);
			const roomName = roomData.roomName || `[[modules:chat.room-id, ${roomId}]]`;
			const notifData = {
				type: isGroupChat ? 'new-group-chat' : 'new-chat',
				subject: roomData.roomName ?
					`[[email:notif.chat.new-message-from-user-in-room, ${displayname}, ${roomName}]]` :
					`[[email:notif.chat.new-message-from-user, ${displayname}]]`,
				bodyShort: isGroupChat || roomData.roomName ? `[[notifications:new-message-in, ${roomName}]]` : `[[notifications:new-message-from, ${displayname}]]`,
				bodyLong: messageObj.content,
				nid: `chat_${roomId}_${fromUid}_${Date.now()}`,
				mergeId: `new-chat|${roomId}`, // as roomId is the differentiator, no distinction between direct vs. group req'd.
				from: fromUid,
				roomId,
				roomName,
				path: `/chats/${messageObj.roomId}`,
			};
			if (roomData.public) {
				const icon = Messaging.getRoomIcon(roomData);
				notifData.type = 'new-public-chat';
				notifData.roomIcon = icon;
				notifData.subject = `[[email:notif.chat.new-message-from-user-in-room, ${displayname}, ${roomName}]]`;
				notifData.bodyShort = `[[notifications:user-posted-in-public-room, ${displayname}, ${icon}, ${roomName}]]`;
				notifData.mergeId = `notifications:user-posted-in-public-room|${roomId}`;
			}
			const notification = await notifications.create(notifData);
			await notifications.push(notification, uidsToNotify);
		}
	}
};
