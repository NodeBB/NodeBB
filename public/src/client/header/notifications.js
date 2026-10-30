'use strict';

define('forum/header/notifications', function () {
	const notifications = {};

	notifications.prepareDOM = function () {
		const notifTrigger = $('[component="notifications"] [data-bs-toggle="dropdown"]');

		function filterNotifications(notifList, filter) {
			notifList.find('[data-nid]').toggleClass('hidden', filter === 'unread')
				.filter('.unread').removeClass('hidden');
		}

		async function loadNotifications(triggerEl) {
			const notifications = await app.require('notifications');
			const dropdownEl = triggerEl.parent().find('.dropdown-menu');
			const listEl = triggerEl.parent().find('[component="notifications/list"]');
			notifications.loadNotifications(triggerEl, listEl, function (data) {
				const hasUnread = data.unread.length > 0;
				dropdownEl.find('[data-filter="all"]').toggleClass('active', !hasUnread);
				dropdownEl.find('[data-filter="unread"]').toggleClass('active', hasUnread);
				filterNotifications(listEl, hasUnread ? 'unread' : 'all');
			});
		}

		notifTrigger.on('show.bs.dropdown', (ev) => {
			loadNotifications($(ev.target));
		});

		notifTrigger.each((index, el) => {
			const triggerEl = $(el);
			const dropdownEl = triggerEl.parent().find('.dropdown-menu');
			const listEl = dropdownEl.find('[component="notifications/list"]');
			if (dropdownEl.hasClass('show')) {
				loadNotifications(triggerEl);
			}

			dropdownEl.on('click', '[data-filter]', (e) => {
				const filter = e.target.getAttribute('data-filter');
				dropdownEl.find('[data-filter]').removeClass('active');
				e.target.classList.add('active');
				filterNotifications(listEl, filter);

				const visibleNotifCount = dropdownEl.find('[data-nid]:not(.hidden)').length;
				dropdownEl.find('.no-notifs').toggleClass('hidden', visibleNotifCount !== 0);
			});
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
