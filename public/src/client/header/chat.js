'use strict';

define('forum/header/chat', [
	'components', 'hooks', 'api',
], function (components, hooks, api) {
	const chat = {};

	chat.prepareDOM = function () {
		const chatsToggleEl = $('[component="chat/dropdown"]');
		chatsToggleEl.on('show.bs.dropdown', (ev) => {
			requireAndCall('loadChatsDropdown', $(ev.target).parent().find('[component="chat/list"]'));
		});

		chatsToggleEl.each((index, el) => {
			const dropdownEl = $(el).parent().find('.dropdown-menu');
			if (dropdownEl.hasClass('show')) {
				requireAndCall('loadChatsDropdown', dropdownEl.find('[component="chat/list"]'));
			}
		});

		socket.removeListener('event:chats.receive', onChatMessageReceived);
		socket.on('event:chats.receive', onChatMessageReceived);

		socket.removeListener('event:chats.typing', onUserTyping);
		socket.on('event:chats.typing', onUserTyping);

		socket.removeListener('event:chats.roomRename', onRoomRename);
		socket.on('event:chats.roomRename', onRoomRename);

		socket.on('event:unread.updateChatCount', async function (data) {
			if (data) {
				const [chatModule, chatPage] = await app.require(['chat', 'forum/chats']);
				if (
					chatModule.isFromBlockedUser(data.fromUid) ||
					chatModule.isLookingAtRoom(data.roomId) ||
					app.user.uid === parseInt(data.fromUid, 10)
				) {
					return;
				}
				chatPage.markChatPageElUnread(data);
				chatPage.updateTeaser(data.roomId, data.teaser);
			}

			let { count } = await api.get('/chats/unread');
			const chatIcon = components.get('chat/icon');
			count = Math.max(0, count);
			chatIcon.toggleClass('fa-comment', count > 0)
				.toggleClass('fa-comment-o', count <= 0);

			const countText = count > 99 ? '99+' : count;
			components.get('chat/icon')
				.toggleClass('unread-count', count > 0)
				.attr('data-content', countText);
			components.get('chat/count').toggleClass('hidden', count <= 0).text(countText);
			hooks.fire('action:chat.updateCount', { count });
		});
	};

	function onChatMessageReceived(data) {
		requireAndCall('onChatMessageReceived', data);
	}

	function onUserTyping(data) {
		requireAndCall('onUserTyping', data);
	}

	function onRoomRename(data) {
		requireAndCall('onRoomRename', data);
	}

	async function requireAndCall(method, param) {
		const chat = await app.require('chat');
		chat[method](param);
	}

	return chat;
});
