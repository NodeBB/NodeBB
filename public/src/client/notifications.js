define('forum/notifications', function() {
	var Notifications = {};

	Notifications.init = function() {
		var listEl = $('.notifications-list');

		$('span.timeago').timeago();

		// Allow the user to click anywhere in the LI
		listEl.on('click', 'li', function(e) {
			this.querySelector('a').click();
		});
	}

	return Notifications;
});
