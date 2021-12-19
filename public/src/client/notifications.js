'use strict';


define('forum/notifications', ['components', 'alerts'], function (components, alerts) {
	const Notifications = {};

	Notifications.init = function () {
		const listEl = $('.notifications-list');
		listEl.on('click', '[component="notifications/item/link"]', function () {
			const nid = $(this).parents('[data-nid]').attr('data-nid');
			socket.emit('notifications.markRead', nid, function (err) {
				if (err) {
					return alerts.error(err);
				}
			});
		});

		components.get('notifications/mark_all').on('click', function () {
			socket.emit('notifications.markAllRead', function (err) {
				if (err) {
					return alerts.error(err);
				}

				components.get('notifications/item').removeClass('unread');
			});
		});
	};

	return Notifications;
});
