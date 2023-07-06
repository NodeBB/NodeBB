'use strict';

define('forum/header/chat', [
	'components', 'hooks',
], function (components, hooks) {
	const chat = {};

	chat.prepareDOM = function () {
		const chatsToggleEl = $('[component="chat/dropdown"]');
		if (!chatsToggleEl.length) {
			return;
		}

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

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);

		socket.removeListener('event:chats.roomRename', onRoomRename);
		socket.on('event:chats.roomRename', onRoomRename);

		socket.on('event:unread.updateChatCount', async function (data) {
			const { message } = data;
			if (message) {
				if (app.user.blocks.includes(parseInt(message.fromUid, 10))) {
					return;
				}
				if (ajaxify.data.template.chats && parseInt(ajaxify.data.roomId, 10) === parseInt(message.roomId, 10)) {
					return;
				}
			}

			let count = await socket.emit('modules.chats.getUnreadCount', {});
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

	function onUserStatusChange(data) {
		requireAndCall('onUserStatusChange', data);
	}

	function onRoomRename(data) {
		requireAndCall('onRoomRename', data);
	}

	function requireAndCall(method, param) {
		require(['chat'], function (chat) {
			chat[method](param);
		});
	}

	return chat;
});
