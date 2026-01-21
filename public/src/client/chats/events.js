
'use strict';


define('forum/chats/events', [
	'forum/chats/messages',
	'chat',
	'components',
], function (messages, chatModule, components) {
	const Events = {};

	const events = {
		'event:chats.receive': chatsReceive,
		'event:chats.public.unread': publicChatUnread,
		'event:user_status_change': onUserStatusChange,
		'event:chats.roomRename': onRoomRename,
		'event:chats.mark': markChatState,
		'event:chats.typing': onChatTyping,
	};
	let chatNavWrapper = null;

	let Chats = null;

	Events.init = async function () {
		Chats = await app.require('forum/chats');
		chatNavWrapper = $('[component="chat/nav-wrapper"]');
		Events.removeListeners();
		for (const [eventName, handler] of Object.entries(events)) {
			socket.on(eventName, handler);
		}
	};

	Events.removeListeners = function () {
		for (const [eventName, handler] of Object.entries(events)) {
			socket.removeListener(eventName, handler);
		}
	};

	function chatsReceive(data) {
		if (chatModule.isFromBlockedUser(data.fromUid)) {
			return;
		}
		if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
			data.self = parseInt(app.user.uid, 10) === parseInt(data.fromUid, 10) ? 1 : 0;
			if (!Chats.newMessage) {
				Chats.newMessage = data.self === 0;
			}
			data.message.self = data.self;
			data.message.timestamp = Math.min(Date.now(), data.message.timestamp);
			data.message.timestampISO = utils.toISOString(data.message.timestamp);
			messages.appendChatMessage($('[component="chat/message/content"]'), data.message);

			Chats.updateTeaser(data.roomId, {
				content: utils.stripHTMLTags(utils.decodeHTMLEntities(data.message.content)),
				user: data.message.fromUser,
				timestampISO: data.message.timestampISO,
			});
		}
	}

	function publicChatUnread(data) {
		if (
			!ajaxify.data.template.chats ||
			chatModule.isFromBlockedUser(data.fromUid) ||
			chatModule.isLookingAtRoom(data.roomId) ||
			app.user.uid === parseInt(data.fromUid, 10)
		) {
			return;
		}
		Chats.markChatPageElUnread(data);
		Chats.increasePublicRoomUnreadCount(chatNavWrapper.find('[data-roomid=' + data.roomId + ']'));
	}

	function onUserStatusChange(data) {
		app.updateUserStatus(
			$(`.chats-list [data-uid="${data.uid}"] [component="user/status"]`), data.status
		);
	}

	function onRoomRename(data) {
		const roomEl = components.get('chat/recent/room', data.roomId);
		if (roomEl.length) {
			const titleEl = roomEl.find('[component="chat/room/title"]');
			ajaxify.data.roomName = data.newName;
			titleEl.translateText(data.newName ? data.newName : ajaxify.data.usernames);
		}
		const titleEl = $(`[component="chat/main-wrapper"][data-roomid="${data.roomId}"] [component="chat/header/title"]`);
		if (titleEl.length) {
			titleEl.html(
				data.newName ?
					`<i class="fa ${ajaxify.data.icon} text-muted"></i> ${data.newName}` :
					ajaxify.data.chatWithMessage
			);
		}
	}

	function markChatState({ roomId, state }) {
		const roomEls = $(`[component="chat/recent"] [data-roomid="${roomId}"], [component="chat/list"] [data-roomid="${roomId}"], [component="chat/public"] [data-roomid="${roomId}"]`);
		roomEls.each((idx, el) => {
			const roomEl = $(el);
			chatModule.markChatElUnread(roomEl, state === 1);
			if (state === 0) {
				Chats.updatePublicRoomUnreadCount(roomEl, 0);
			}
		});
	}

	function onChatTyping(data) {
		if (data.uid === app.user.uid || chatModule.isFromBlockedUser(data.uid)) {
			return;
		}
		chatModule.updateTypingUserList($(`[component="chat/main-wrapper"][data-roomid="${data.roomId}"]`), data);
	}

	return Events;
});
