'use strict';

import user from '../user';
import notifications from '../notifications';

const SocketNotifs = {} as any;

SocketNotifs.get = async function (socket, data) {
	if (data && Array.isArray(data.nids) && socket.uid) {
		return await user.notifications.getNotifications(data.nids, socket.uid);
	}
	return await user.notifications.get(socket.uid);
};

SocketNotifs.getCount = async function (socket) {
	return await user.notifications.getUnreadCount(socket.uid);
};

SocketNotifs.deleteAll = async function (socket) {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	await user.notifications.deleteAll(socket.uid);
};

SocketNotifs.markRead = async function (socket, nid) {
	await notifications.markRead(nid, socket.uid);
	user.notifications.pushCount(socket.uid);
};

SocketNotifs.markUnread = async function (socket, nid) {
	await notifications.markUnread(nid, socket.uid);
	user.notifications.pushCount(socket.uid);
};

SocketNotifs.markAllRead = async function (socket) {
	await notifications.markAllRead(socket.uid);
	user.notifications.pushCount(socket.uid);
};

import promisify from '../promisify';
promisify(SocketNotifs);

export default SocketNotifs;