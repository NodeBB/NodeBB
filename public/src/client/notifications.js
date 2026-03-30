'use strict';


define('forum/notifications', ['components', 'notifications'], function (components, notifications) {
	const Notifications = {};

	Notifications.init = function () {
		const listEl = $('.notifications-list');
		listEl.on('click', '[component="notifications/item/link"]', function () {
			const nid = $(this).parents('[data-nid]').attr('data-nid');
			notifications.markNotification(nid, true);
		});
		notifications.handleUnreadButton(listEl);

		components.get('notifications/mark_all').on('click', function () {
			notifications.markAllRead(ajaxify.data.selectedFilter.filter, function () {
				components.get('notifications/item').removeClass('unread');
			});
		});
	};

	return Notifications;
});
