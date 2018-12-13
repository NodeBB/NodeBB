'use strict';


define('forum/footer', [
	'components',
	'translator',
	'forum/unread',
	'forum/header/notifications',
	'forum/header/chat',
], function (components, translator, Unread, Notifications, Chat) {
	Notifications.prepareDOM();
	Chat.prepareDOM();
	translator.prepareDOM();

	socket.on('event:unread.updateChatCount', function (count) {
		components.get('chat/icon')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);
	});

	if (app.user.uid > 0) {
		Unread.initUnreadTopics();
	}
});
