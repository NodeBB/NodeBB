'use strict';

/* globals define, config, app, ajaxify, utils, socket, templates */

define('forum/chats', ['components', 'string', 'sounds', 'forum/infinitescroll', 'translator'], function(components, S, sounds, infinitescroll, translator) {
	var Chats = {
		initialised: false
	};

	var newMessage = false;

	Chats.init = function() {
		var env = utils.findBootstrapEnvironment();

		if (!Chats.initialised) {
			Chats.addSocketListeners();
			Chats.addGlobalEventListeners();
		}

		Chats.addEventListeners();

		if (env === 'md' || env === 'lg') {
			Chats.resizeMainWindow();
			Chats.addHotkeys();
		}

		Chats.scrollToBottom($('.expanded-chat ul'));

		Chats.initialised = true;
	};

	Chats.getRecipientUid = function() {
		return parseInt($('.expanded-chat').attr('data-uid'), 10);
	};

	Chats.isCurrentChat = function(uid) {
		return Chats.getRecipientUid() === parseInt(uid, 10);
	};

	Chats.addEventListeners = function() {
		components.get('chat/recent').on('click', 'li', function(e) {
			Chats.switchChat(parseInt($(this).attr('data-uid'), 10), $(this).attr('data-username'));
		});

		Chats.addSendHandlers(Chats.getRecipientUid(), $('.chat-input'), $('.expanded-chat button[data-action="send"]'));

		$('[data-action="pop-out"]').on('click', function() {
			var	username = $('.expanded-chat').attr('data-username'),
				uid = Chats.getRecipientUid(),
				text = components.get('chat/input').val();

			if (app.previousUrl && app.previousUrl.match(/chats/)) {
				ajaxify.go('chats', function() {
					app.openChat(username, uid);
				}, true);
			} else {
				window.history.go(-1);
				app.openChat(username, uid);
			}

			$(window).one('action:chat.loaded', function() {
				components.get('chat/input').val(text);
			});
		});

		$('.recent-chats').on('scroll', function() {
			var $this = $(this);
			var bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
			if ($this.scrollTop() > bottom) {
				loadMoreRecentChats();
			}
		});

		Chats.addSinceHandler(Chats.getRecipientUid(), $('.expanded-chat .chat-content'), $('.expanded-chat [data-since]'));
	};

	Chats.addHotkeys = function() {
		Mousetrap.bind('ctrl+up', function() {
			var activeContact = $('.chats-list .bg-primary'),
				prev = activeContact.prev();

			if (prev.length) {
				Chats.switchChat(parseInt(prev.attr('data-uid'), 10), prev.attr('data-username'));
			}

			$('[component="chat/input"]').focus();
		});
		Mousetrap.bind('ctrl+down', function() {
			var activeContact = $('.chats-list .bg-primary'),
				next = activeContact.next();

			if (next.length) {
				Chats.switchChat(parseInt(next.attr('data-uid'), 10), next.attr('data-username'));
			}

			$('[component="chat/input"]').focus();
		});
	};

	Chats.addSinceHandler = function(toUid, chatContentEl, sinceEl) {
		sinceEl.on('click', function() {
			var since = $(this).attr('data-since');
			sinceEl.removeClass('selected');
			$(this).addClass('selected');
			Chats.loadChatSince(toUid, chatContentEl, since);
			return false;
		});
	};

	Chats.addSendHandlers = function(toUid, inputEl, sendEl) {

		inputEl.off('keypress').on('keypress', function(e) {
			if (e.which === 13 && !e.shiftKey) {
				Chats.sendMessage(toUid, inputEl);
				return false;
			}
		});

		inputEl.off('keyup').on('keyup', function() {
			var val = !!$(this).val();
			if ((val && $(this).attr('data-typing') === 'true') || (!val && $(this).attr('data-typing') === 'false')) {
				return;
			}

			Chats.notifyTyping(toUid, val);
			$(this).attr('data-typing', val);
		});

		sendEl.off('click').on('click', function(e) {
			Chats.sendMessage(toUid, inputEl);
			inputEl.focus();
			return false;
		});
	};

	Chats.switchChat = function(uid, username) {
		if (!$('[component="chat/messages"]').length) {
			return ajaxify.go('chats/' + utils.slugify(username));
		}

		var contactEl = $('.chats-list [data-uid="' + uid + '"]');

		Chats.loadChatSince(uid, $('.chat-content'), 'recent');
		Chats.addSendHandlers(uid, $('[component="chat/input"]'), $('[data-action="send"]'));
		contactEl.addClass('bg-primary').siblings().removeClass('bg-primary');
		$('[component="chat/title"]').text(username);
		$('[component="chat/messages"]').attr('data-uid', uid).attr('data-username', username);
		$('[component="breadcrumb/current"]').text(username);

		if (window.history && window.history.pushState) {
			var url = 'chats/' + utils.slugify(username);

			window.history.pushState({
				url: url
			}, url, RELATIVE_PATH + '/' + url);
		}
	};

	Chats.loadChatSince = function(toUid, chatContentEl, since) {
		if (!toUid) {
			return;
		}
		socket.emit('modules.chats.get', {touid: toUid, since: since}, function(err, messages) {
			if (err) {
				return app.alertError(err.message);
			}

			chatContentEl.find('.chat-message').remove();

			Chats.appendChatMessage(chatContentEl, messages);
		});
	};

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

	Chats.appendChatMessage = function(chatContentEl, data) {

		var lastSpeaker = parseInt(chatContentEl.find('.chat-message').last().attr('data-uid'), 10);
		if (!Array.isArray(data)) {
			data.newSet = lastSpeaker !== data.fromuid;
		}

		Chats.parseMessage(data, function(html) {
			onMessagesParsed(chatContentEl, html);
		});
	};

	function onMessagesParsed(chatContentEl, html) {
		var newMessage = $(html);

		newMessage.appendTo(chatContentEl);
		newMessage.find('.timeago').timeago();
		newMessage.find('img:not(.not-responsive)').addClass('img-responsive');
		Chats.scrollToBottom(chatContentEl);
	}

	Chats.addSocketListeners = function() {
		socket.on('event:chats.receive', function(data) {
			if (Chats.isCurrentChat(data.withUid)) {
				newMessage = data.self === 0;
				data.message.self = data.self;

				Chats.appendChatMessage($('.expanded-chat .chat-content'), data.message);
			} else {
				var contactEl = $('[component="chat/recent"] li[data-uid="' + data.withUid + '"]'),
					userKey = data.withUid === data.message.fromuid ? 'fromUser' : 'toUser';

				// Spawn a new contact if required
				templates.parse('partials/chat_contact', {
					uid: data.withUid,
					username: data.message[userKey].username,
					status: data.message[userKey].status,
					picture: data.message[userKey].picture,
					teaser: {
						content: data.message.cleanedContent,
						timestampISO: new Date(Date.now()).toISOString()
					}
				}, function(html) {
					translator.translate(html, function(translatedHTML) {
						if (contactEl.length) {
							contactEl.replaceWith(translatedHTML);
						} else {
							$('[component="chat/recent"]').prepend(translatedHTML);
						}

						// Mark that contact list entry unread
						$('.chats-list li[data-uid="' + data.withUid + '"]').addClass('unread').find('.timeago').timeago();
						app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + data.message.fromUser.username + ']]');
					});
				});
			}
		});

		socket.on('event:chats.userStartTyping', function(withUid) {
			$('.chats-list li[data-uid="' + withUid + '"]').addClass('typing');
		});

		socket.on('event:chats.userStopTyping', function(withUid) {
			$('.chats-list li[data-uid="' + withUid + '"]').removeClass('typing');
		});

		socket.on('event:user_status_change', function(data) {
			app.updateUserStatus($('.chats-list [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
		});
	};

	Chats.resizeMainWindow = function() {
		var	messagesList = $('.expanded-chat .chat-content');

		if (messagesList.length) {
			var	margin = $('.expanded-chat ul').outerHeight(true) - $('.expanded-chat ul').height(),
				inputHeight = $('.chat-input').outerHeight(true),
				fromTop = messagesList.offset().top;

			messagesList.height($(window).height() - (fromTop + inputHeight + (margin * 4)));
			components.get('chat/recent').height($('.expanded-chat').height());
		}

		Chats.setActive();
	};

	Chats.notifyTyping = function(toUid, typing) {
		socket.emit('modules.chats.user' + (typing ? 'Start' : 'Stop') + 'Typing', {
			touid: toUid,
			fromUid: app.user.uid
		});
	};

	Chats.sendMessage = function(toUid, inputEl) {
		var msg = inputEl.val();
		if (msg.length > config.maximumChatMessageLength) {
			return app.alertError('[[error:chat-message-too-long]]');
		}

		if (!msg.length) {
			return;
		}

		inputEl.val('');
		socket.emit('modules.chats.send', {
			touid: toUid,
			message: msg
		}, function(err) {
			if (err) {
				if (err.message === '[[error:email-not-confirmed-chat]]') {
					return app.showEmailConfirmWarning(err);
				}
				return app.alertError(err.message);
			}

			sounds.play('chat-outgoing');
			Chats.notifyTyping(toUid, false);
		});
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

		app.parseAndTranslate('chats', 'chats', {chats: users}, function(html) {
			$('.recent-chats').append(html);
			callback();
		});
	}

	return Chats;
});
