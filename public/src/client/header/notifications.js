'use strict';

define('forum/header/notifications', function () {
	const notifications = {};

	notifications.prepareDOM = function () {
		const notifTrigger = $('[component="notifications"] [data-bs-toggle="dropdown"]');
		if (!notifTrigger.length) {
			return;
		}

		notifTrigger.on('show.bs.dropdown', (ev) => {
			requireAndCall('loadNotifications', $(ev.target).parent().find('[component="notifications/list"]'));
		});

		notifTrigger.each((index, el) => {
			const dropdownEl = $(el).parent().find('.dropdown-menu');
			if (dropdownEl.hasClass('show')) {
				requireAndCall('loadNotifications', dropdownEl.find('[component="notifications/list"]'));
			}
		});

		socket.removeListener('event:new_notification', onNewNotification);
		socket.on('event:new_notification', onNewNotification);

		socket.removeListener('event:notifications.updateCount', onUpdateCount);
		socket.on('event:notifications.updateCount', onUpdateCount);
	};

	function onNewNotification(data) {
		requireAndCall('onNewNotification', data);
	}

	function onUpdateCount(data) {
		requireAndCall('updateNotifCount', data);
	}

	function requireAndCall(method, param) {
		require(['notifications'], function (notifications) {
			notifications[method](param);
		});
	}

	return notifications;
});
