'use strict';

const user = require('../user');

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
