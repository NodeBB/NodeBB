'use strict';

/* globals define, config, app, ajaxify, utils, socket, templates, Mousetrap, bootbox */

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
		Chats.createTagsInput(ajaxify.data.roomId, ajaxify.data.users);

		if (env === 'md' || env === 'lg') {
			Chats.resizeMainWindow();
			Chats.addHotkeys();
		}

		Chats.scrollToBottom($('.expanded-chat ul'));

		Chats.initialised = true;

		if (ajaxify.data.hasOwnProperty('roomId')) {
			components.get('chat/input').focus();
		}
	};

	Chats.addEventListeners = function() {
		$('[component="chat/recent"]').on('click', '[component="chat/recent/room"]', function() {
			Chats.switchChat($(this).attr('data-roomid'));
		});

		Chats.addSendHandlers(ajaxify.data.roomId, $('.chat-input'), $('.expanded-chat button[data-action="send"]'));

		$('[data-action="pop-out"]').on('click', function() {

			var text = components.get('chat/input').val();
			var roomId = ajaxify.data.roomId;

			if (app.previousUrl && app.previousUrl.match(/chats/)) {
				ajaxify.go('chats', function() {
					app.openChat(roomId);
				}, true);
			} else {
				window.history.go(-1);
				app.openChat(roomId);
			}

			$(window).one('action:chat.loaded', function() {
				components.get('chat/input').val(text);
			});
		});

		components.get('chat/messages')
			.on('click', '[data-action="edit"]', function() {
				var messageId = $(this).parents('[data-mid]').attr('data-mid');
				var inputEl = components.get('chat/input');
				Chats.prepEdit(inputEl, messageId, ajaxify.data.roomId);
			})
			.on('click', '[data-action="delete"]', function() {
				var messageId = $(this).parents('[data-mid]').attr('data-mid');
				Chats.delete(messageId);
			});

		$('.recent-chats').on('scroll', function() {
			var $this = $(this);
			var bottom = ($this[0].scrollHeight - $this.height()) * 0.9;
			if ($this.scrollTop() > bottom) {
				loadMoreRecentChats();
			}
		});

		Chats.addSinceHandler(ajaxify.data.roomId, $('.expanded-chat .chat-content'), $('.expanded-chat [data-since]'));
	};

	Chats.addHotkeys = function() {
		Mousetrap.bind('ctrl+up', function() {
			var activeContact = $('.chats-list .bg-primary'),
				prev = activeContact.prev();

			if (prev.length) {
				Chats.switchChat(prev.attr('data-roomid'));
			}
		});
		Mousetrap.bind('ctrl+down', function() {
			var activeContact = $('.chats-list .bg-primary'),
				next = activeContact.next();

			if (next.length) {
				Chats.switchChat(next.attr('data-roomid'));
			}
		});
		Mousetrap.bind('up', function(e) {
			if (e.target === components.get('chat/input').get(0)) {
				// Retrieve message id from messages list
				var message = components.get('chat/messages').find('.chat-message[data-self="1"]').last();
				var lastMid = message.attr('data-mid');
				var inputEl = components.get('chat/input');

				Chats.prepEdit(inputEl, lastMid, ajaxify.data.roomId);
			}
		});
	};

	Chats.prepEdit = function(inputEl, messageId, roomId) {
		socket.emit('modules.chats.getRaw', { mid: messageId, roomId: roomId }, function(err, raw) {
			if (err) {
				return app.alertError(err.message);
			}
			// Populate the input field with the raw message content
			if (inputEl.val().length === 0) {
				// By setting the `data-mid` attribute, I tell the chat code that I am editing a
				// message, instead of posting a new one.
				inputEl.attr('data-mid', messageId).addClass('editing');
				inputEl.val(raw);
			}
		});
	};

	Chats.delete = function(messageId) {
		translator.translate('[[modules:chat.delete_message_confirm]]', function(translated) {
			bootbox.confirm(translated, function(ok) {
				if (!ok) {
					return;
				}

				socket.emit('modules.chats.delete', {
					messageId: messageId
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					components.get('chat/message', messageId).slideUp('slow', function() {
						$(this).remove();
					});
				});
			});
		});
	};

	Chats.addSinceHandler = function(roomId, chatContentEl, sinceEl) {
		sinceEl.on('click', function() {
			var since = $(this).attr('data-since');
			sinceEl.removeClass('selected');
			$(this).addClass('selected');
			Chats.loadChatSince(roomId, chatContentEl, since);
			return false;
		});
	};

	Chats.addSendHandlers = function(roomId, inputEl, sendEl) {

		inputEl.off('keypress').on('keypress', function(e) {
			if (e.which === 13 && !e.shiftKey) {
				Chats.sendMessage(roomId, inputEl);
				return false;
			}
		});

		inputEl.off('keyup').on('keyup', function() {
			var val = !!$(this).val();
			if ((val && $(this).attr('data-typing') === 'true') || (!val && $(this).attr('data-typing') === 'false')) {
				return;
			}

			Chats.notifyTyping(roomId, val);
			$(this).attr('data-typing', val);
		});

		sendEl.off('click').on('click', function() {
			Chats.sendMessage(roomId, inputEl);
			inputEl.focus();
			return false;
		});
	};

	Chats.createTagsInput = function(roomId, users) {
		var tagEl = $('.users-tag-input');

		tagEl.tagsinput({
			confirmKeys: [13, 44],
			trimValue: true
		});

		if (users && users.length) {
			users.forEach(function(user) {
				tagEl.tagsinput('add', user.username);
			});
		}

		tagEl.on('itemAdded', function(event) {
			if (event.item === app.user.username) {
				return;
			}
			socket.emit('modules.chats.addUserToRoom', {roomId: roomId, username: event.item}, function(err) {
				if (err && err.message === '[[error:no-user]]') {
					tagEl.tagsinput('remove', event.item);
				}
			});
		});

		tagEl.on('beforeItemRemove', function(event) {
			event.cancel = !ajaxify.data.owner;
		});

		tagEl.on('itemRemoved', function(event) {
			socket.emit('modules.chats.removeUserFromRoom', {roomId: roomId, username: event.item});
		});

		var input = $('.users-tag-container').find('.bootstrap-tagsinput input');

		require(['autocomplete'], function(autocomplete) {
			autocomplete.user(input);
		});
	};

	Chats.switchChat = function(roomid) {
		ajaxify.go('chats/' + roomid);
	};

	Chats.loadChatSince = function(roomId, chatContentEl, since) {
		if (!roomId) {
			return;
		}
		socket.emit('modules.chats.get', {roomId: roomId, since: since}, function(err, messages) {
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
			if (newMessage && ajaxify.data.roomId) {
				socket.emit('modules.chats.markRead', ajaxify.data.roomId);
				newMessage = false;
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
			if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				newMessage = data.self === 0;
				data.message.self = data.self;

				Chats.appendChatMessage($('.expanded-chat .chat-content'), data.message);
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

		socket.on('event:chats.edit', function(data) {

			data.messages.forEach(function(message) {
				templates.parse('partials/chat_message', {
					messages: message
				}, function(html) {
					var body = components.get('chat/message', message.messageId);
					if (body.length) {
						body.replaceWith(html);
						components.get('chat/message', message.messageId).find('.timeago').timeago();
					}
				});
			});
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

	Chats.notifyTyping = function(roomId, typing) {
		socket.emit('modules.chats.user' + (typing ? 'Start' : 'Stop') + 'Typing', {
			roomId: roomId,
			fromUid: app.user.uid
		});
	};

	Chats.sendMessage = function(roomId, inputEl) {
		var msg = inputEl.val(),
			mid = inputEl.attr('data-mid');

		if (msg.length > config.maximumChatMessageLength) {
			return app.alertError('[[error:chat-message-too-long]]');
		}

		if (!msg.length) {
			return;
		}

		inputEl.val('');
		inputEl.removeAttr('data-mid');

		if (!mid) {
			socket.emit('modules.chats.send', {
				roomId: roomId,
				message: msg
			}, function(err) {
				if (err) {
					if (err.message === '[[error:email-not-confirmed-chat]]') {
						return app.showEmailConfirmWarning(err);
					}
					return app.alertError(err.message);
				}

				sounds.play('chat-outgoing');
				Chats.notifyTyping(roomId, false);
			});
		} else {
			socket.emit('modules.chats.edit', {
				mid: mid,
				message: msg
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				Chats.notifyTyping(roomId, false);
			});
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
		if (ajaxify.data.roomId) {
			socket.emit('modules.chats.markRead', ajaxify.data.roomId);
			$('.expanded-chat input').focus();
		}
		$('.chats-list li').removeClass('bg-primary');
		$('.chats-list li[data-roomid="' + ajaxify.data.roomId + '"]').addClass('bg-primary');
	};

	Chats.parseMessage = function(data, callback) {
		templates.parse('partials/chat_message' + (Array.isArray(data) ? 's' : ''), {
			messages: data
		}, function(html) {
			translator.translate(html, callback);
		});
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
