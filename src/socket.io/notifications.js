'use strict';

const user = require('../user');
const notifications = require('../notifications');

const SocketNotifs = module.exports;

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
	sockets.warnDeprecated(socket, 'PUT /api/v3/notifications/:nid/read');
	await api.notifications.markRead(socket, { nid });
};

SocketNotifs.markUnread = async function (socket, nid) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/notifications/:nid/read');
	await api.notifications.markUnread(socket, { nid });
};

SocketNotifs.markAllRead = async function (socket, data) {
	const filter = data && data.filter ? data.filter : '';
	await notifications.markAllRead(socket.uid, filter);
	user.notifications.pushCount(socket.uid);
};

require('../promisify')(SocketNotifs);
