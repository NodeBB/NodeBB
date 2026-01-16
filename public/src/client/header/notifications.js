'use strict';

define('forum/header/notifications', function () {
	const notifications = {};

	notifications.prepareDOM = function () {
		const notifTrigger = $('[component="notifications"] [data-bs-toggle="dropdown"]');

		notifTrigger.on('show.bs.dropdown', async (ev) => {
			const notifications = await app.require('notifications');
			const triggerEl = $(ev.target);
			notifications.loadNotifications(triggerEl, triggerEl.parent().find('[component="notifications/list"]'));
		});

		notifTrigger.each((index, el) => {
			const triggerEl = $(el);
			const dropdownEl = triggerEl.parent().find('.dropdown-menu');
			if (dropdownEl.hasClass('show')) {
				app.require('notifications').then((notifications) => {
					notifications.loadNotifications(triggerEl, dropdownEl.find('[component="notifications/list"]'));
				});
			}
		});

		socket.removeListener('event:new_notification', onNewNotification);
		socket.on('event:new_notification', onNewNotification);

		socket.removeListener('event:notifications.updateCount', onUpdateCount);
		socket.on('event:notifications.updateCount', onUpdateCount);
	};

	async function onNewNotification(data) {
		const notifications = await app.require('notifications');
		notifications.onNewNotification(data);
	}

	async function onUpdateCount(data) {
		const notifications = await app.require('notifications');
		notifications.updateNotifCount(data);
	}

	return notifications;
});
