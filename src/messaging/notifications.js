'use strict';

const winston = require('winston');

const batch = require('../batch');
const db = require('../database');
const notifications = require('../notifications');
const user = require('../user');
const io = require('../socket.io');
const plugins = require('../plugins');
const meta = require('../meta');

module.exports = function (Messaging) {
	// Only used to notify a user of a new chat message
	Messaging.notifyQueue = {};

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

		// Delayed notifications
		let queueObj = Messaging.notifyQueue[`${fromUid}:${roomId}`];
		if (queueObj) {
			queueObj.message.content += `\n${messageObj.content}`;
			clearTimeout(queueObj.timeout);
		} else {
			queueObj = {
				message: messageObj,
			};
			Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
		}

		queueObj.timeout = setTimeout(async () => {
			try {
				await sendNotification(fromUid, roomId, queueObj.message);
				delete Messaging.notifyQueue[`${fromUid}:${roomId}`];
			} catch (err) {
				winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
			}
		}, meta.config.notificationSendDelay * 1000);
	};

	async function sendNotification(fromUid, roomId, messageObj) {
		fromUid = parseInt(fromUid, 10);

		const [settings, roomData] = await Promise.all([
			db.getObject(`chat:room:${roomId}:notification:settings`),
			Messaging.getRoomData(roomId),
		]);
		const roomDefault = roomData.notificationSetting;
		const uidsToNotify = [];
		const { ALLMESSAGES } = Messaging.notificationSettings;
		await batch.processSortedSet(`chat:room:${roomId}:uids:online`, async (uids) => {
			uids = uids.filter(
				uid => (parseInt((settings && settings[uid]) || roomDefault, 10) === ALLMESSAGES) &&
					fromUid !== parseInt(uid, 10)
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
			const notifData = {
				type: isGroupChat ? 'new-group-chat' : 'new-chat',
				subject: `[[email:notif.chat.subject, ${displayname}]]`,
				bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
				bodyLong: messageObj.content,
				nid: `chat_${roomId}_${fromUid}`,
				from: fromUid,
				roomId: roomId,
				path: `/chats/${messageObj.roomId}`,
			};
			if (roomData.public) {
				const icon = Messaging.getRoomIcon(roomData);
				const roomName = roomData.roomName || `[[modules:chat.room-id, ${roomId}]]`;
				notifData.type = 'new-public-chat';
				notifData.roomName = roomName;
				notifData.roomIcon = icon;
				notifData.subject = `[[email:notif.chat.public-chat-subject, ${displayname}, ${roomName}]]`;
				notifData.bodyShort = `[[notifications:user_posted_in_public_room, ${displayname}, ${icon}, ${roomName}]]`;
				notifData.mergeId = `notifications:user_posted_in_public_room|${roomId}`;
			}
			const notification = await notifications.create(notifData);
			await notifications.push(notification, uidsToNotify);
		}
	}
};
