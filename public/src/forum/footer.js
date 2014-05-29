define('forum/footer', ['notifications', 'chat'], function(Notifications, Chat) {

	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	function updateUnreadCount(err, count) {
		var unreadEl = $('#unread-count');

		if (err) {
			console.warn('Error updating unread count', err);
		}

		unreadEl
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 20 ? '20+' : count);
	}


	socket.on('event:unread.updateCount', updateUnreadCount);
	socket.emit('user.getUnreadCount', updateUnreadCount);
});
