'use strict';

/* globals define, app*/

define('forum/chats', function() {
	var Chats = {};

	Chats.init = function() {
		Chats.addEventListeners();
		Chats.addSocketListeners();
	};

	Chats.getRecipientUid = function() {
		return parseInt($('.expanded-chat').attr('data-uid'), 10);
	};

	Chats.isCurrentChat = function(uid) {
		uid = parseInt(uid, 10);
		if (Chats.getRecipientUid() === uid) {
			return true;
		} else {
			return false;
		}
	};

	Chats.addEventListeners = function() {
		var inputEl = $('.chat-input');

		$('.chats-list').on('click', 'li', function(e) {
			// app.openChat($(this).attr('data-username'), $(this).attr('data-uid'));
			ajaxify.go('chats/' + utils.slugify($(this).attr('data-username')));
		});

		// inputEl.off('keypress').on('keypress', function(e) {
		// 	if(e.which === 13) {
		// 		Chat.sendMessage(chatModal);
		// 	}
		// });

		inputEl.off('keyup').on('keyup', function() {
			if ($(this).val()) {
				Chats.notifyTyping(true);
			} else {
				Chats.notifyTyping(false);
			}
		});

		// chatModal.find('#chat-message-send-btn').off('click').on('click', function(e){
		// 	sendMessage(chatModal);
		// 	return false;
		// });
	};

	Chats.addSocketListeners = function() {
		var typingNotifEl = $('.user-typing');

		socket.on('event:chats.receive', function(data) {

		});

		socket.on('event:chats.userStartTyping', function(withUid) {
			if (Chats.isCurrentChat(withUid)) {
				typingNotifEl.removeClass('hide');
			}
		});

		socket.on('event:chats.userStopTyping', function(withUid) {
			if (Chats.isCurrentChat(withUid)) {
				typingNotifEl.addClass('hide');
			}
		});
	};

	Chats.notifyTyping = function(typing) {
		socket.emit('modules.chats.user' + (typing ? 'Start' : 'Stop') + 'Typing', {
			touid: Chats.getRecipientUid(),
			fromUid: app.uid
		});
	};

	return Chats;
});
