'use strict';

const user = require('../user');
const notifications = require('../notifications');

const notificationsApi = module.exports;

notificationsApi.list = async (caller) => {
	const { read, unread } = await user.notifications.get(caller.uid);
	return { read, unread };
};

notificationsApi.get = async (caller, { nid }) => {
	let notification = await user.notifications.getNotifications([nid], caller.uid);
	notification = notification.pop();

	return { notification };
};

notificationsApi.getCount = async (caller) => {
	const unread = await user.notifications.getUnreadCount(caller.uid);
	return { unread };
};

notificationsApi.markRead = async (caller, { nid }) => {
	await notifications.markRead(nid, caller.uid);
	user.notifications.pushCount(caller.uid);
};

notificationsApi.markUnread = async (caller, { nid }) => {
	await notifications.markUnread(nid, caller.uid);
	user.notifications.pushCount(caller.uid);
};