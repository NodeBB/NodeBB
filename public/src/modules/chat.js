"use strict";
/* globals app, config, define, socket, templates, utils, ajaxify */

define('chat', ['components', 'taskbar', 'string', 'sounds', 'forum/chats', 'translator'], function(components, taskbar, S, sounds, Chats, translator) {

	var module = {};
	var newMessage = false;

	module.prepareDOM = function() {
		var	chatsToggleEl = $('#chat_dropdown'),
			chatsListEl = $('#chat-list'),
			dropdownEl;

		chatsToggleEl.on('click', function() {
			if (chatsToggleEl.parent().hasClass('open')) {
				return;
			}

			socket.emit('modules.chats.getRecentChats', {after: 0}, function(err, chats) {
				if (err) {
					return app.alertError(err.message);
				}
				chats = chats.users;
				var	userObj;

				chatsListEl.empty();

				if (!chats.length) {
					translator.translate('[[modules:chat.no_active]]', function(str) {
						$('<li />')
							.addClass('no_active')
							.html('<a href="#">' + str + '</a>')
							.appendTo(chatsListEl);
					});
					return;
				}

				for(var x = 0; x<chats.length; ++x) {
					userObj = chats[x];
					dropdownEl = $('<li class="' + (userObj.unread ? 'unread' : '') + '"/>')
						.attr('data-uid', userObj.uid)
						.html('<a data-ajaxify="false">'+
							'<img src="' +	userObj.picture + '" title="' +	userObj.username +'" />' +
							'<i class="fa fa-circle status ' + userObj.status + '"></i> ' +
							userObj.username + '</a>')
						.appendTo(chatsListEl);

					(function(userObj) {
						dropdownEl.click(function() {
							if (!ajaxify.currentPage.match(/^chats\//)) {
								app.openChat(userObj.username, userObj.uid);
							} else {
								ajaxify.go('chats/' + utils.slugify(userObj.username));
							}
						});
					})(userObj);
				}
			});
		});

		socket.on('event:chats.receive', function(data) {
			if (ajaxify.currentPage.slice(0, 6) === 'chats/') {
				// User is on the chats page, so do nothing (src/forum/chats.js will handle it)
				return;
			}

			var username = data.message.fromUser.username;
			var isSelf = parseInt(data.message.fromUser.uid, 10) === parseInt(app.user.uid, 10);
			data.message.self = data.self;
			if (isSelf) {
				username = data.message.toUser.username;
			}
			newMessage = data.self === 0;
			if (module.modalExists(data.withUid)) {
				var modal = module.getModal(data.withUid);
				module.appendChatMessage(modal, data.message);

				if (modal.is(":visible")) {
					taskbar.updateActive(modal.attr('UUID'));
					Chats.scrollToBottom(modal.find('#chat-content'));
				} else {
					module.toggleNew(modal.attr('UUID'), true);
				}

				if (!isSelf && (!modal.is(":visible") || !app.isFocused)) {
					app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
					sounds.play('chat-incoming');
				}
			} else {
				module.createModal(username, data.withUid, function(modal) {
					module.toggleNew(modal.attr('UUID'), true);
					if (!isSelf) {
						app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
						sounds.play('chat-incoming');
					}
				});
			}
		});

		socket.on('event:chats.userStartTyping', function(withUid) {
			var modal = module.getModal(withUid);
			var chatContent = modal.find('#chat-content');
			if (!chatContent.length) {
				return;
			}
			var atBottom = chatContent[0].scrollHeight - chatContent.scrollTop() === chatContent.innerHeight();

			modal.find('.user-typing').removeClass('hide');
			if (atBottom) {
				Chats.scrollToBottom(chatContent);
			}
		});

		socket.on('event:chats.userStopTyping', function(withUid) {
			var modal = module.getModal(withUid);
			modal.find('.user-typing').addClass('hide');
		});

		socket.on('event:user_status_change', function(data) {
			var modal = module.getModal(data.uid);
			app.updateUserStatus(modal.find('[component="user/status"]'), data.status);
		});
	};

	module.bringModalToTop = function(chatModal) {
		var topZ = 0;

		taskbar.updateActive(chatModal.attr('UUID'));

		if ($('.chat-modal').length === 1) {
			return;
		}
		$('.chat-modal').each(function() {
			var thisZ = parseInt($(this).css('zIndex'), 10);
			if (thisZ > topZ) {
				topZ = thisZ;
			}
		});

		chatModal.css('zIndex', topZ + 1);
	};

	module.getModal = function(touid) {
		return $('#chat-modal-' + touid);
	};

	module.modalExists = function(touid) {
		return $('#chat-modal-' + touid).length !== 0;
	};

	function checkStatus(chatModal) {
		socket.emit('user.checkStatus', chatModal.attr('touid'), function(err, status) {
			if (err) {
				return app.alertError(err.message);
			}

			app.updateUserStatus(chatModal.find('[component="user/status"]'), status);
		});
	}

	module.createModal = function(username, touid, callback) {
		templates.parse('chat', {}, function(chatTpl) {
			translator.translate(chatTpl, function (chatTpl) {

				var chatModal = $(chatTpl),
					uuid = utils.generateUUID(),
					dragged = false;

				chatModal.attr('id', 'chat-modal-' + touid);
				chatModal.attr('touid', touid);
				chatModal.attr('intervalId', 0);
				chatModal.attr('UUID', uuid);
				chatModal.css('position', 'fixed');
				chatModal.css('zIndex', 100);
				chatModal.appendTo($('body'));
				module.center(chatModal);
				chatModal.draggable({
					start:function() {
						module.bringModalToTop(chatModal);
					},
					stop:function() {
						chatModal.find('#chat-message-input').focus();
					},
					distance: 10,
					handle: '.modal-header'
				});

				chatModal.find('.modal-content').resizable({
					minHeight: 250,
					minWidth: 400
				});

				chatModal.find('.modal-content').on('resize', function(event, ui) {
					if (ui.originalSize.height === ui.size.height) {
						return;
					}

					chatModal.find('#chat-content').css('height', module.calculateChatListHeight(chatModal));
				});

				chatModal.find('#chat-with-name').html(username);

				chatModal.find('#chat-close-btn').on('click', function() {
					module.close(chatModal);
				});

				function gotoChats() {
					var text = components.get('chat/input').val();
					$(window).one('action:ajaxify.end', function() {
						components.get('chat/input').val(text);
					});
					
					ajaxify.go('chats/' + utils.slugify(username));
					module.close(chatModal);
				}

				chatModal.find('.modal-header').on('dblclick', gotoChats);
				chatModal.find('button[data-action="maximize"]').on('click', gotoChats);

				chatModal.on('click', function(e) {
					module.bringModalToTop(chatModal);

					if (!dragged) {
						chatModal.find('#chat-message-input').focus();
					} else {
						dragged = false;
					}
				});

				chatModal.on('mousemove', function(e) {
					if (e.which === 1) {
						dragged = true;
					}
				});

				chatModal.on('mousemove keypress click', function() {
					if (newMessage) {
						socket.emit('modules.chats.markRead', touid);
						newMessage = false;
					}
				});

				chatModal.find('[data-since]').on('click', function() {
					var since = $(this).attr('data-since');
					chatModal.find('[data-since]').removeClass('selected');
					$(this).addClass('selected');
					loadChatSince(chatModal, since);
					return false;
				});

				addSendHandler(chatModal);

				getChatMessages(chatModal, function() {
					checkStatus(chatModal);
				});

				module.canMessage(touid, function(err) {
					if (err) {
						// Disable the text input
						chatModal.find('input[type="text"]').attr('disabled', true);
					}
				});

				chatModal.find('.user-typing .text').translateText('[[modules:chat.user_typing, ' + username + ']]');

				taskbar.push('chat', chatModal.attr('UUID'), {
					title: username,
					touid: touid,
					icon: 'fa-comment',
					state: ''
				});

				$(window).trigger('action:chat.loaded', chatModal);

				callback(chatModal);
			});
		});
	};

	module.focusInput = function(chatModal) {
		chatModal.find('#chat-message-input').focus();
	};

	module.close = function(chatModal) {
		clearInterval(chatModal.attr('intervalId'));
		chatModal.attr('intervalId', 0);
		chatModal.remove();
		chatModal.data('modal', null);
		taskbar.discard('chat', chatModal.attr('UUID'));
		Chats.notifyTyping(chatModal.attr('touid'), false);

		if (chatModal.attr('data-mobile')) {
			module.disableMobileBehaviour(chatModal);
		}
	};

	module.center = function(chatModal) {
		var hideAfter = false;
		if (chatModal.hasClass('hide')) {
			chatModal.removeClass('hide');
			hideAfter = true;
		}
		chatModal.css('left', Math.max(0, (($(window).width() - $(chatModal).outerWidth()) / 2) + $(window).scrollLeft()) + 'px');
		chatModal.css('top', Math.max(0, $(window).height() / 2 - $(chatModal).outerHeight() / 2) + 'px');

		if (hideAfter) {
			chatModal.addClass('hide');
		}
		return chatModal;
	};

	module.load = function(uuid) {
		var chatModal = $('div[UUID="'+uuid+'"]');
		chatModal.removeClass('hide');
		checkStatus(chatModal);
		taskbar.updateActive(uuid);
		Chats.scrollToBottom(chatModal.find('#chat-content'));
		module.bringModalToTop(chatModal);
		module.focusInput(chatModal);
		socket.emit('modules.chats.markRead', chatModal.attr('touid'));

		var env = utils.findBootstrapEnvironment();
		if (env === 'xs' || env === 'sm') {
			module.enableMobileBehaviour(chatModal);
		}
	};

	module.enableMobileBehaviour = function(modalEl) {
		app.toggleNavbar(false);
		modalEl.attr('data-mobile', '1');
		var messagesEl = modalEl.find('#chat-content');
		messagesEl.css('height', module.calculateChatListHeight(modalEl));

		$(window).on('resize', function() {
			messagesEl.css('height', module.calculateChatListHeight(modalEl));
		});
	};

	module.disableMobileBehaviour = function(modalEl) {
		app.toggleNavbar(true);
	};

	module.calculateChatListHeight = function(modalEl) {
		var totalHeight = modalEl.find('.modal-content').outerHeight() - modalEl.find('.modal-header').outerHeight(),
			padding = parseInt(modalEl.find('.modal-body').css('padding-top'), 10) + parseInt(modalEl.find('.modal-body').css('padding-bottom'), 10),
			contentMargin = parseInt(modalEl.find('#chat-content').css('margin-top'), 10) + parseInt(modalEl.find('#chat-content').css('margin-bottom'), 10),
			sinceHeight = modalEl.find('.since-bar').outerHeight(true),
			inputGroupHeight = modalEl.find('.input-group').outerHeight();

		return totalHeight - padding - contentMargin - sinceHeight - inputGroupHeight;
	};

	module.minimize = function(uuid) {
		var chatModal = $('div[UUID="' + uuid + '"]');
		chatModal.addClass('hide');
		taskbar.minimize('chat', uuid);
		clearInterval(chatModal.attr('intervalId'));
		chatModal.attr('intervalId', 0);
		Chats.notifyTyping(chatModal.attr('touid'), false);
	};

	function getChatMessages(chatModal, callback) {
		socket.emit('modules.chats.get', {touid: chatModal.attr('touid'), since: 'recent'}, function(err, messages) {
			module.appendChatMessage(chatModal, messages, callback);
		});
	}

	function loadChatSince(chatModal, since, callback) {
		socket.emit('modules.chats.get', {touid: chatModal.attr('touid'), since: since}, function(err, messages) {
			var chatContent = chatModal.find('#chat-content');
			chatContent.find('.chat-message').remove();
			module.appendChatMessage(chatModal, messages, callback);
		});
	}

	function addSendHandler(chatModal) {
		var input = chatModal.find('#chat-message-input');
		input.off('keypress').on('keypress', function(e) {
			if (e.which === 13 && !e.shiftKey) {
				Chats.sendMessage(chatModal.attr('touid'), input);
			}
		});

		input.off('keyup').on('keyup', function() {
			var val = !!$(this).val();
			if ((val && $(this).attr('data-typing') === 'true') || (!val && $(this).attr('data-typing') === 'false')) {
				return;
			}

			Chats.notifyTyping(chatModal.attr('touid'), val);
			$(this).attr('data-typing', val);
		});

		chatModal.find('#chat-message-send-btn').off('click').on('click', function(e){
			Chats.sendMessage(chatModal.attr('touid'), input);
			return false;
		});
	}

	module.appendChatMessage = function(chatModal, data, done) {
		var chatContent = chatModal.find('#chat-content'),
			typingNotif = chatModal.find('.user-typing');

		Chats.parseMessage(data, function(html) {
			var message = $(html);
			message.find('img:not(".chat-user-image")').addClass('img-responsive');
			message.find('.timeago').timeago();
			message.insertBefore(typingNotif);
			Chats.scrollToBottom(chatContent);

			if (typeof done === 'function') {
				done();
			}
		});
	};

	module.toggleNew = function(uuid, state) {
		taskbar.toggleNew(uuid, state);
	};

	module.canMessage = function(toUid, callback) {
		socket.emit('modules.chats.canMessage', toUid, callback);
	};

	return module;
});
