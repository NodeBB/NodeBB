'use strict';

const winston = require('winston');

// const db = require('../database');
const user = require('../user');
const notifications = require('../notifications');
const sockets = require('../socket.io');
const plugins = require('../plugins');
const meta = require('../meta');

module.exports = function (Messaging) {
	Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser

	Messaging.notifyUsersInRoom = async (fromUid, roomId, messageObj) => {
		// const isPublic = parseInt(await db.getObjectField(`chat:room:${roomId}`, 'public'), 10) === 1;

		let uids = await Messaging.getUidsInRoom(roomId, 0, -1);
		uids = await user.blocks.filterUids(fromUid, uids);

		let data = {
			roomId: roomId,
			fromUid: fromUid,
			message: messageObj,
			uids: uids,
		};
		data = await plugins.hooks.fire('filter:messaging.notify', data);
		if (!data || !data.uids || !data.uids.length) {
			return;
		}

		// const gg = await sockets.in('online_users').fetchSockets();
		// console.log('derp');
		// gg.forEach(g => console.log(g.rooms));

		uids = data.uids;
		uids.forEach((uid) => {
			data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;

			// TODO: user is offline :( why push unread
			// maybe move this to client side, when user receives chat msg update count?
			// sockets.in(`chat_room_${roomId}`).emit('event:chats.receive', data);

			Messaging.pushUnreadCount(uid);

			sockets.in(`uid_${uid}`).emit('event:chats.receive', data);
		});
		if (messageObj.system) {
			return;
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
				await sendNotifications(fromUid, uids, roomId, queueObj.message);
			} catch (err) {
				winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
			}
		}, meta.config.notificationSendDelay * 1000);
	};

	async function sendNotifications(fromuid, uids, roomId, messageObj) {
		const hasRead = await Messaging.hasRead(uids, roomId);
		uids = uids.filter((uid, index) => !hasRead[index] && parseInt(fromuid, 10) !== parseInt(uid, 10));
		if (!uids.length) {
			delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
			return;
		}

		const { displayname } = messageObj.fromUser;

		const isGroupChat = await Messaging.isGroupChat(roomId);
		const notification = await notifications.create({
			type: isGroupChat ? 'new-group-chat' : 'new-chat',
			subject: `[[email:notif.chat.subject, ${displayname}]]`,
			bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
			bodyLong: messageObj.content,
			nid: `chat_${fromuid}_${roomId}`,
			from: fromuid,
			path: `/chats/${messageObj.roomId}`,
		});

		delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
		notifications.push(notification, uids);
	}
};
