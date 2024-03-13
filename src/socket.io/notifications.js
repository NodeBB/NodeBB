'use strict';

const user = require('../user');
const notifications = require('../notifications');
const api = require('../api');

const sockets = require('.');

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

require('../promisify')(SocketNotifs);
