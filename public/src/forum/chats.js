'use strict';

/* globals define, app*/

define('forum/chats', ['string','sounds'], function(S, sounds) {
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
		var inputEl = $('.chat-input'),
			sendEl = $('.expanded-chat button[data-action="send"]');

		$('.chats-list').on('click', 'li', function(e) {
			// app.openChat($(this).attr('data-username'), $(this).attr('data-uid'));
			ajaxify.go('chats/' + utils.slugify($(this).attr('data-username')));
		});

		inputEl.off('keypress').on('keypress', function(e) {
			if(e.which === 13) {
				Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			}
		});

		inputEl.off('keyup').on('keyup', function() {
			if ($(this).val()) {
				Chats.notifyTyping(Chats.getRecipientUid(), true);
			} else {
				Chats.notifyTyping(Chats.getRecipientUid(), false);
			}
		});

		sendEl.off('click').on('click', function(e) {
			Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			return false;
		});
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

	Chats.notifyTyping = function(toUid, typing) {
		socket.emit('modules.chats.user' + (typing ? 'Start' : 'Stop') + 'Typing', {
			touid: toUid,
			fromUid: app.uid
		});
	};

	Chats.sendMessage = function(toUid, inputEl) {
		var msg = S(inputEl.val()).stripTags().s;
		if (msg.length) {
			msg = msg +'\n';
			socket.emit('modules.chats.send', {
				touid:toUid,
				message:msg
			});
			inputEl.val('');
			sounds.play('chat-outgoing');
			Chats.notifyTyping(toUid, false);
		}
	};

	return Chats;
});
