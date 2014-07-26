define('forum/footer', ['notifications', 'chat'], function(Notifications, Chat) {

	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	function updateUnreadTopicCount(err, count) {
		if (err) {
			return console.warn('Error updating unread count', err);
		}

		$('#unread-count')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 20 ? '20+' : count);
	}

	function updateUnreadChatCount(err, count) {
		if (err) {
			return console.warn('Error updating unread count', err);
		}

		$('#chat-count')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 20 ? '20+' : count);
	}


	socket.on('event:unread.updateCount', updateUnreadTopicCount);
	socket.emit('user.getUnreadCount', updateUnreadTopicCount);

	socket.on('event:unread.updateChatCount', updateUnreadChatCount);
	socket.emit('user.getUnreadChatCount', updateUnreadChatCount);
});
