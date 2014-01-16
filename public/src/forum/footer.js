define(['notifications', 'chat'], function(Notifications, Chat) {

	socket.emit('meta.updateHeader', {
		fields: ['username', 'picture', 'userslug']
	}, app.updateHeader);

	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	function updateUnreadCount(count) {
		$('#unread-count').toggleClass('unread-count', count > 0);
		$('#unread-count').attr('data-content', count > 20 ? '20+' : count);
	}

	socket.on('event:unread.updateCount', updateUnreadCount);
	socket.emit('user.getUnreadCount', updateUnreadCount);
});