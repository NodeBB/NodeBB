'use strict';

/* globals define, socket, app */

define('forum/notifications', function() {
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

		$('span.timeago').timeago();

		$('.notifications .delete').on('click', function() {
			socket.emit('notifications.markAllRead', function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				$('.notifications .delete').addClass('hidden');
				$('.notifications .alert-info').removeClass('hidden');
				listEl.empty();
			});
		});
	};

	return Notifications;
});
