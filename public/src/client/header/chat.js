'use strict';

define('forum/header/chat', ['components'], function (components) {
	var chat = {};

	chat.prepareDOM = function () {
		var chatsToggleEl = components.get('chat/dropdown');
		var chatsListEl = components.get('chat/list');

		chatsToggleEl.on('click', function () {
			if (chatsToggleEl.parent().hasClass('open')) {
				return;
			}
			requireAndCall('loadChatsDropdown', chatsListEl);
		});

		if (chatsToggleEl.parents('.dropdown').hasClass('open')) {
			requireAndCall('loadChatsDropdown', chatsListEl);
		}

		socket.on('event:chats.receive', function (data) {
			requireAndCall('onChatMessageReceived', data);
		});

		socket.on('event:user_status_change', function (data) {
			requireAndCall('onUserStatusChange', data);
		});

		socket.on('event:chats.roomRename', function (data) {
			requireAndCall('onRoomRename', data);
		});
	};

	function requireAndCall(method, param) {
		require(['chat'], function (chat) {
			chat[method](param);
		});
	}

	return chat;
});
