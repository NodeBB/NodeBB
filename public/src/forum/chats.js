'use strict';

/* globals define, app, ajaxify, utils, socket, templates */

define('forum/chats', ['string', 'sounds'], function(S, sounds) {
	var Chats = {
		initialised: false
	};

	Chats.init = function() {
		var containerEl = $('.expanded-chat ul');

		if (!Chats.initialised) {
			Chats.addSocketListeners();
		}

		Chats.addEventListeners();
		Chats.scrollToBottom(containerEl);
		Chats.setActive();

		Chats.initialised = true;
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
			ajaxify.go('chats/' + utils.slugify($(this).attr('data-username')));
		});

		inputEl.on('keypress', function(e) {
			if(e.which === 13) {
				Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			}
		});

		inputEl.on('keyup', function() {
			if ($(this).val()) {
				Chats.notifyTyping(Chats.getRecipientUid(), true);
			} else {
				Chats.notifyTyping(Chats.getRecipientUid(), false);
			}
		});

		sendEl.on('click', function(e) {
			Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			return false;
		});
	};

	Chats.addSocketListeners = function() {
		socket.on('event:chats.receive', function(data) {
			var typingNotifEl = $('.user-typing'),
				containerEl = $('.expanded-chat ul');

			if (Chats.isCurrentChat(data.withUid)) {
				Chats.parseMessage(data.message, function(html) {
					var newMessage = $(html);
					newMessage.insertBefore(typingNotifEl);
					newMessage.find('span.timeago').timeago();
					newMessage.find('img:not(".chat-user-image")').addClass('img-responsive');
					Chats.scrollToBottom(containerEl);
				});
			} else {
				$('.chats-list li[data-uid="' + data.withUid + '"]').addClass('unread');
				app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + data.message.username + ']]');
			}
		});

		socket.on('event:chats.userStartTyping', function(withUid) {
			var typingNotifEl = $('.user-typing');

			if (Chats.isCurrentChat(withUid)) {
				typingNotifEl.removeClass('hide');
			}

			$('.chats-list li[data-uid="' + withUid + '"]').addClass('typing');
		});

		socket.on('event:chats.userStopTyping', function(withUid) {
			var typingNotifEl = $('.user-typing');

			if (Chats.isCurrentChat(withUid)) {
				typingNotifEl.addClass('hide');
			}

			$('.chats-list li[data-uid="' + withUid + '"]').removeClass('typing');
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

	Chats.scrollToBottom = function(containerEl) {
		if (containerEl.length) {
			containerEl.scrollTop(
				containerEl[0].scrollHeight - containerEl.height()
			);
		}
	};

	Chats.setActive = function() {
		console.log(Chats.getRecipientUid());
		$('.chats-list li').removeClass('bg-primary');
		$('.chats-list li[data-uid="' + Chats.getRecipientUid() + '"]').addClass('bg-primary');
	};

	Chats.parseMessage = function(data, callback) {
		templates.parse('partials/chat_message' + (Array.isArray(data) ? 's' : ''), {
			messages: data
		}, callback);
	};

	return Chats;
});
