'use strict';

/* globals define, app, ajaxify, utils, socket, templates */

define('forum/chats', [
	'components',
	'translator',
	'mousetrap',
	'forum/chats/recent',
	'forum/chats/search',
	'forum/chats/messages'
], function(components, translator, mousetrap, recentChats, search, messages) {
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
		Chats.createTagsInput($('[component="chat/messages"] .users-tag-input'), ajaxify.data);
		Chats.createAutoComplete($('[component="chat/input"]'));

		if (env === 'md' || env === 'lg') {
			Chats.resizeMainWindow();
			Chats.addHotkeys();
		}

		messages.scrollToBottom($('.expanded-chat ul'));

		Chats.initialised = true;

		search.init();

		if (ajaxify.data.hasOwnProperty('roomId')) {
			components.get('chat/input').focus();
		}
	};

	Chats.addEventListeners = function() {
		$('[component="chat/recent"]').on('click', '[component="chat/leave"]', function() {
			Chats.leave($(this).parents('[data-roomid]'));
			return false;
		});

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

		Chats.addEditDeleteHandler(components.get('chat/messages'), ajaxify.data.roomId);

		recentChats.init();

		Chats.addSinceHandler(ajaxify.data.roomId, $('.expanded-chat .chat-content'), $('.expanded-chat [data-since]'));
		Chats.addRenameHandler(ajaxify.data.roomId, $('[component="chat/room/name"]'));
	};

	Chats.addEditDeleteHandler = function(element, roomId) {
		element.on('click', '[data-action="edit"]', function() {
			var messageId = $(this).parents('[data-mid]').attr('data-mid');
			var inputEl = components.get('chat/input');
			messages.prepEdit(inputEl, messageId, roomId);
		}).on('click', '[data-action="delete"]', function() {
			var messageId = $(this).parents('[data-mid]').attr('data-mid');
			messages.delete(messageId, roomId);
		});
	};

	Chats.addHotkeys = function() {
		mousetrap.bind('ctrl+up', function() {
			var activeContact = $('.chats-list .bg-primary'),
				prev = activeContact.prev();

			if (prev.length) {
				Chats.switchChat(prev.attr('data-roomid'));
			}
		});
		mousetrap.bind('ctrl+down', function() {
			var activeContact = $('.chats-list .bg-primary'),
				next = activeContact.next();

			if (next.length) {
				Chats.switchChat(next.attr('data-roomid'));
			}
		});
		mousetrap.bind('up', function(e) {
			if (e.target === components.get('chat/input').get(0)) {
				// Retrieve message id from messages list
				var message = components.get('chat/messages').find('.chat-message[data-self="1"]').last();
				var lastMid = message.attr('data-mid');
				var inputEl = components.get('chat/input');

				messages.prepEdit(inputEl, lastMid, ajaxify.data.roomId);
			}
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

	Chats.addRenameHandler = function(roomId, inputEl) {
		var oldName = inputEl.val();
		inputEl.on('blur keypress', function(ev) {
			if (ev.type === 'keypress' && ev.keyCode !== 13) {
				return;
			}
			var newName = inputEl.val();

			if (oldName === newName) {
				return;
			}
			socket.emit('modules.chats.renameRoom', {roomId: roomId, newName: newName}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				oldName = newName;
				inputEl.blur();
			});
		});
	};

	Chats.addSendHandlers = function(roomId, inputEl, sendEl) {
		inputEl.off('keypress').on('keypress', function(e) {
			if (e.which === 13 && !e.shiftKey) {
				messages.sendMessage(roomId, inputEl);
				return false;
			}
		});

		sendEl.off('click').on('click', function() {
			messages.sendMessage(roomId, inputEl);
			inputEl.focus();
			return false;
		});
	};

	Chats.createAutoComplete = function(element) {
		var data = {
			element: element,
			strategies: [],
			options: {
				zIndex: 20000,
				listPosition: function(position) {
					this.$el.css(this._applyPlacement(position));
					this.$el.css('position', 'absolute');
					return this;
				}
			}
		};

		$(window).trigger('chat:autocomplete:init', data);
		if (data.strategies.length) {
			data.element.textcomplete(data.strategies, data.options);
		}
	};

	Chats.createTagsInput = function(tagEl, data) {
		tagEl.tagsinput({
			confirmKeys: [13, 44],
			trimValue: true
		});

		if (data.users && data.users.length) {
			data.users.forEach(function(user) {
				tagEl.tagsinput('add', $('<div/>').html(user.username).text());
			});
		}

		tagEl.on('beforeItemAdd', function(event) {
			event.cancel = event.item === app.user.username;
		});

		tagEl.on('itemAdded', function(event) {
			if (event.item === app.user.username) {
				return;
			}
			socket.emit('modules.chats.addUserToRoom', {roomId: data.roomId, username: event.item}, function(err) {
				if (err) {
					app.alertError(err.message);
					tagEl.tagsinput('remove', event.item, {nouser: true});
				}
			});
		});

		tagEl.on('beforeItemRemove', function(event) {
			if (event.options && event.options.nouser) {
				return;
			}

			event.cancel = !data.isOwner || tagEl.tagsinput('items').length < 2;
			if (!data.owner) {
				return app.alertError('[[error:not-allowed]]');
			}

			if (tagEl.tagsinput('items').length < 2) {
				return app.alertError('[[error:cant-remove-last-user]]');
			}
		});

		tagEl.on('itemRemoved', function(event) {
			if (event.options && event.options.nouser) {
				return;
			}
			socket.emit('modules.chats.removeUserFromRoom', {roomId: data.roomId, username: event.item}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
			});
		});

		var input = $('.users-tag-container').find('.bootstrap-tagsinput input');

		require(['autocomplete'], function(autocomplete) {
			autocomplete.user(input);
		});
	};

	Chats.leave = function(el) {
		var roomId = el.attr('data-roomid');
		socket.emit('modules.chats.leave', roomId, function(err) {
			if (err) {
				return app.alertError(err.message);
			}
			if (parseInt(roomId, 10) === ajaxify.data.roomId) {
				ajaxify.go('chats');
			} else {
				el.remove();
			}
		});
	};

	Chats.switchChat = function(roomid) {
		ajaxify.go('chats/' + roomid);
	};

	Chats.loadChatSince = function(roomId, chatContentEl, since) {
		if (!roomId) {
			return;
		}
		socket.emit('modules.chats.get', {roomId: roomId, since: since}, function(err, messageData) {
			if (err) {
				return app.alertError(err.message);
			}

			chatContentEl.find('[component="chat/message"]').remove();

			messages.appendChatMessage(chatContentEl, messageData);
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

	Chats.addSocketListeners = function() {
		socket.on('event:chats.receive', function(data) {
			if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				newMessage = data.self === 0;
				data.message.self = data.self;

				messages.appendChatMessage($('.expanded-chat .chat-content'), data.message);
			} else {
				if (ajaxify.currentPage.startsWith("chats")) {
					var roomEl = $('[data-roomid=' + data.roomId + ']');

					if (roomEl.length > 0) {
						roomEl.addClass("unread");
					} else {
						var recentEl = components.get('chat/recent');
						templates.parse('partials/chat_recent_room', {
							rooms: { "roomId": data.roomId, "lastUser": data.message.fromUser, "usernames": data.message.fromUser.username, "unread": true }
						}, function(html) {
							translator.translate(html, function(translated) {
							    recentEl.prepend(translated);
							});
						});
					}
				}
			}
		});

		socket.on('event:user_status_change', function(data) {
			app.updateUserStatus($('.chats-list [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
		});

		messages.onChatMessageEdit();

		socket.on('event:chats.roomRename', function(data) {
			$('[component="chat/room/name"]').val($('<div/>').html(data.newName).text());
		});
	};

	Chats.resizeMainWindow = function() {
		var	messagesList = $('.expanded-chat .chat-content');

		if (messagesList.length) {
			var margin = $('.expanded-chat ul').outerHeight(true) - $('.expanded-chat ul').height();
			var inputHeight = $('.chat-input').outerHeight(true);
			var fromTop = messagesList.offset().top;
			var searchHeight = $('.chat-search').height();
			var searchListHeight = $('[component="chat/search/list"]').outerHeight(true) - $('[component="chat/search/list"]').height();

			messagesList.height($(window).height() - (fromTop + inputHeight + (margin * 4)));
			components.get('chat/recent').height($('.expanded-chat').height() - (searchHeight + searchListHeight));
			$('[component="chat/search/list"]').css('max-height', components.get('chat/recent').height()/2 + 'px');
		}

		Chats.setActive();
	};

	Chats.setActive = function() {
		if (ajaxify.data.roomId) {
			socket.emit('modules.chats.markRead', ajaxify.data.roomId);
			$('.expanded-chat input').focus();
		}
		$('.chats-list li').removeClass('bg-primary');
		$('.chats-list li[data-roomid="' + ajaxify.data.roomId + '"]').addClass('bg-primary');
	};


	return Chats;
});
