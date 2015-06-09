'use strict';

/* globals define, socket, app */

define('forum/notifications', ['components'], function(components) {
	var Notifications = {};

	Notifications.init = function() {
		var listEl = $('.notifications-list');
		listEl.on('click', 'a', function(e) {
			var nid = $(this).parents('[data-nid]').attr('data-nid');
			socket.emit('notifications.markRead', nid, function(err) {
				if (err) {
					return app.alertError(err);
				}
			});
		});

		$('.timeago').timeago();

		components.get('notifications/mark_all').on('click', function() {
			socket.emit('notifications.markAllRead', function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				components.get('notifications/item').removeClass('unread');
			});
		});
	};

	return Notifications;
});
