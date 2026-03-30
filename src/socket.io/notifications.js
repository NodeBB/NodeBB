'use strict';

const user = require('../user');
const notifications = require('../notifications');

const SocketNotifs = module.exports;

SocketNotifs.get = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/notifications/(:nid)');

	// Passing in multiple nids is no longer supported in apiv3
	if (data && Array.isArray(data.nids) && socket.uid) {
		const notifications = await Promise.all(data.nids.map(async (nid) => {
			const { notification } = await api.notifications.get(socket, { nid });
			return notification;
		}));

		return notifications;
	}

	const response = await api.notifications.list(socket);
	response.uid = socket.uid;
	return response;
};

SocketNotifs.getCount = async function (socket) {
	sockets.warnDeprecated(socket, 'GET /api/v3/notifications/count');

	const { unread } = await api.notifications.getCount(socket);
	return unread;
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
