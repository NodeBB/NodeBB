'use strict';

/* globals define, app, ajaxify, utils, socket, templates */

define('forum/chats', ['string', 'sounds', 'forum/infinitescroll'], function(S, sounds, infinitescroll) {
	var Chats = {
		initialised: false
	};

	var newMessage = false;

	Chats.init = function() {
		var containerEl = $('.expanded-chat ul');

		if (!Chats.initialised) {
			Chats.addSocketListeners();
			Chats.addGlobalEventListeners();
		}

		Chats.addEventListeners();
		Chats.resizeMainWindow();
		Chats.scrollToBottom(containerEl);
		Chats.setActive();

		Chats.initialised = true;
	};

	Chats.getRecipientUid = function() {
		return parseInt($('.expanded-chat').attr('data-uid'), 10);
	};

	Chats.isCurrentChat = function(uid) {
		return Chats.getRecipientUid() === parseInt(uid, 10);
	};

	Chats.addEventListeners = function() {
		var inputEl = $('.chat-input'),
			sendEl = $('.expanded-chat button[data-action="send"]'),
			popoutEl = $('[data-action="pop-out"]');

		$('.chats-list').on('click', 'li', function(e) {
			ajaxify.go('chats/' + utils.slugify($(this).attr('data-username')));
		});

		inputEl.on('keypress', function(e) {
			if(e.which === 13) {
				Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			}
		});

		inputEl.on('keyup', function() {
			var val = !!$(this).val();
			if ((val && $(this).attr('data-typing') === 'true') || (!val && $(this).attr('data-typing') === 'false')) {
				return;
			}

			Chats.notifyTyping(Chats.getRecipientUid(), val);
			$(this).attr('data-typing', val);
		});

		sendEl.on('click', function(e) {
			Chats.sendMessage(Chats.getRecipientUid(), inputEl);
			return false;
		});

		popoutEl.on('click', function() {
			var	username = $('.expanded-chat').attr('data-username'),
				uid = Chats.getRecipientUid();

			if (app.previousUrl && app.previousUrl.match(/chats/)) {
				ajaxify.go('chats', function() {
					app.openChat(username, uid);
				}, true);
			} else {
				window.history.go(-1);
			}
		});

		$('.recent-chats').on('scroll', function() {
			var $this = $(this);
			var bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
			if ($this.scrollTop() > bottom) {
				loadMoreRecentChats();
			}
		});

		$('.expanded-chat [data-since]').on('click', function() {
			var since = $(this).attr('data-since');
			$('.expanded-chat [data-since]').removeClass('selected');
			$(this).addClass('selected');
			loadChatSince(since);
			return false;
		});
	};

	function loadChatSince(since) {
		var uid = Chats.getRecipientUid();
		if (!uid) {
			return;
		}
		socket.emit('modules.chats.get', {touid: uid, since: since}, function(err, messages) {
			var chatContent = $('.expanded-chat .chat-content');
			chatContent.find('.chat-message').remove();
			Chats.parseMessage(messages, onMessagesParsed);
		});
	}

	Chats.addGlobalEventListeners = function() {
		$(window).on('resize', Chats.resizeMainWindow);
		$(window).on('mousemove keypress click', function() {
			if (newMessage) {
				var recipientUid = Chats.getRecipientUid();
				if (recipientUid) {
					socket.emit('modules.chats.markRead', recipientUid);
					newMessage = false;
				}
			}
		});
	};

	function onMessagesParsed(html) {
		var newMessage = $(html);
		newMessage.insertBefore($('.user-typing'));
		newMessage.find('span.timeago').timeago();
		newMessage.find('img:not(".chat-user-image")').addClass('img-responsive');
		Chats.scrollToBottom($('.expanded-chat .chat-content'));
	}

	Chats.addSocketListeners = function() {
		socket.on('event:chats.receive', function(data) {
			var typingNotifEl = $('.user-typing'),
				containerEl = $('.expanded-chat ul');

			if (Chats.isCurrentChat(data.withUid)) {
				newMessage = data.self === 0;
				data.message.self = data.self;
				Chats.parseMessage(data.message, onMessagesParsed);
			} else {
				$('.chats-list li[data-uid="' + data.withUid + '"]').addClass('unread');
				app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + data.message.fromUser.username + ']]');
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

		socket.on('event:user_status_change', function(data) {
			var userEl = $('.chats-list li[data-uid="' + data.uid +'"]');

			if (userEl.length) {
				var statusEl = userEl.find('.status');
				translator.translate('[[global:' + data.status + ']]', function(translated) {
					statusEl.attr('class', 'fa fa-circle status ' + data.status)
						.attr('title', translated)
						.attr('data-original-title', translated);
				});
			}
		});
	};

	Chats.resizeMainWindow = function() {
		var	messagesList = $('.expanded-chat ul');

		if (messagesList.length) {
			var	margin = $('.expanded-chat ul').outerHeight(true) - $('.expanded-chat ul').height(),
				inputHeight = $('.chat-input').outerHeight(true),
				fromTop = messagesList.offset().top;

			messagesList.height($(window).height() - (fromTop + inputHeight + (margin * 4)));
		}
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
		var recipientUid = Chats.getRecipientUid();
		if (recipientUid) {
			socket.emit('modules.chats.markRead', recipientUid);
			$('.expanded-chat input').focus();
		}
		$('.chats-list li').removeClass('bg-primary');
		$('.chats-list li[data-uid="' + recipientUid + '"]').addClass('bg-primary');
	};

	Chats.parseMessage = function(data, callback) {
		templates.parse('partials/chat_message' + (Array.isArray(data) ? 's' : ''), {
			messages: data
		}, callback);
	};

	function loadMoreRecentChats() {
		var recentChats = $('.recent-chats');
		if (recentChats.attr('loading')) {
			return;
		}
		recentChats.attr('loading', 1);
		socket.emit('modules.chats.getRecentChats', {
			after: recentChats.attr('data-nextstart')
		}, function(err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			if (data && data.users.length) {
				onRecentChatsLoaded(data.users, function() {
					recentChats.removeAttr('loading');
					recentChats.attr('data-nextstart', data.nextStart);
				});
			} else {
				recentChats.removeAttr('loading');
			}
		});
	}

	function onRecentChatsLoaded(users, callback) {
		users = users.filter(function(user) {
			return !$('.recent-chats li[data-uid=' + user.uid + ']').length;
		});

		if (!users.length) {
			return callback();
		}

		infinitescroll.parseAndTranslate('chats', 'chats', {chats: users}, function(html) {
			$('.recent-chats').append(html);
			callback();
		});
	}

	return Chats;
});
