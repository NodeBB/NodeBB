define('forum/notifications', function() {
	var Notifications = {};

	Notifications.init = function() {
		var listEl = $('.notifications-list');
		listEl.on('click', 'li', function(e) {
			this.querySelector('a').click();
		});

		$('span.timeago').timeago();

		$('.notifications .delete').on('click', function() {
			socket.emit('notifications.deleteAll', function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				$('.notifications .delete').addClass('hidden');
				$('.notifications .alert-info').removeClass('hidden');
				listEl.empty();
			});
		});

	}

	return Notifications;
});
