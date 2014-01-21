define(['notifications', 'chat'], function(Notifications, Chat) {

	socket.emit('meta.updateHeader', {
		fields: ['username', 'picture', 'userslug']
	}, app.updateHeader);

	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	function updateUnreadCount(err, tids) {
		var count = 0;
		if(tids && tids.length) {
			count = tids.length;
		}

		var postContainer = $('#post-container');
		if(postContainer.length) {
			var tid = postContainer.attr('data-tid');
			if(tids && tids.length > 0 && tids.indexOf(tid) !== -1) {
				socket.emit('topics.markAsRead', {tid: tid, uid: app.uid});
				return;
			}
		}

		$('#unread-count').toggleClass('unread-count', count > 0);
		$('#unread-count').attr('data-content', count > 20 ? '20+' : count);
	}


	socket.on('event:unread.updateCount', updateUnreadCount);
	socket.emit('user.getUnreadCount', updateUnreadCount);
});