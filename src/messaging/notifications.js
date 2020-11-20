'use strict';

const user = require('../user');
const notifications = require('../notifications');
const sockets = require('../socket.io');
const plugins = require('../plugins');
const meta = require('../meta');

module.exports = function (Messaging) {
	Messaging.notifyQueue = {};	// Only used to notify a user of a new chat message, see Messaging.notifyUser

	Messaging.notifyUsersInRoom = async (fromUid, roomId, messageObj) => {
		let uids = await Messaging.getUidsInRoom(roomId, 0, -1);
		uids = await user.blocks.filterUids(fromUid, uids);

		let data = {
			roomId: roomId,
			fromUid: fromUid,
			message: messageObj,
			uids: uids,
		};
		data = await plugins.fireHook('filter:messaging.notify', data);
		if (!data || !data.uids || !data.uids.length) {
			return;
		}

		uids = data.uids;
		uids.forEach(function (uid) {
			data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;
			Messaging.pushUnreadCount(uid);
			sockets.in('uid_' + uid).emit('event:chats.receive', data);
		});
		if (messageObj.system) {
			return;
		}
		// Delayed notifications
		let queueObj = Messaging.notifyQueue[fromUid + ':' + roomId];
		if (queueObj) {
			queueObj.message.content += '\n' + messageObj.content;
			clearTimeout(queueObj.timeout);
		} else {
			queueObj = {
				message: messageObj,
			};
			Messaging.notifyQueue[fromUid + ':' + roomId] = queueObj;
		}

		queueObj.timeout = setTimeout(function () {
			sendNotifications(fromUid, uids, roomId, queueObj.message);
		}, (parseFloat(meta.config.notificationSendDelay) || 60) * 1000);
	};

	async function sendNotifications(fromuid, uids, roomId, messageObj) {
		const isOnline = await user.isOnline(uids);
		uids = uids.filter((uid, index) => !isOnline[index] && parseInt(fromuid, 10) !== parseInt(uid, 10));
		if (!uids.length) {
			return;
		}

		const isGroupChat = await Messaging.isGroupChat(roomId);
		const notification = await notifications.create({
			type: isGroupChat ? 'new-group-chat' : 'new-chat',
			subject: '[[email:notif.chat.subject, ' + messageObj.fromUser.username + ']]',
			bodyShort: '[[notifications:new_message_from, ' + messageObj.fromUser.username + ']]',
			bodyLong: messageObj.content,
			nid: 'chat_' + fromuid + '_' + roomId,
			from: fromuid,
			path: '/chats/' + messageObj.roomId,
		});

		delete Messaging.notifyQueue[fromuid + ':' + roomId];
		notifications.push(notification, uids);
	}
};
