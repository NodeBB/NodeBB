"use strict";
/* globals app, config, define, socket, templates, utils, ajaxify */

define('chat', ['components', 'taskbar', 'string', 'sounds', 'forum/chats', 'translator'], function(components, taskbar, S, sounds, Chats, translator) {

	var module = {};
	var newMessage = false;

	module.prepareDOM = function() {
		var	chatsToggleEl = components.get('chat/dropdown'),
			chatsListEl = components.get('chat/list');

		chatsToggleEl.on('click', function() {
			if (chatsToggleEl.parent().hasClass('open')) {
				return;
			}

			module.loadChatsDropdown(chatsListEl);
		});

		socket.on('event:chats.receive', function(data) {
			var username = data.message.fromUser.username;
			var isSelf = parseInt(data.message.fromUser.uid, 10) === parseInt(app.user.uid, 10);
			data.message.self = data.self;
			if (isSelf) {
				username = data.message.toUser.username;
			}
			newMessage = data.self === 0;
			if (module.modalExists(data.withUid)) {
				var modal = module.getModal(data.withUid);

				Chats.appendChatMessage(modal.find('.chat-content'), data.message);

				if (modal.is(":visible")) {
					taskbar.updateActive(modal.attr('UUID'));
					Chats.scrollToBottom(modal.find('.chat-content'));
				} else {
					module.toggleNew(modal.attr('UUID'), true, true);
				}

				if (!isSelf && (!modal.is(":visible") || !app.isFocused)) {
					app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
					sounds.play('chat-incoming');

					taskbar.push('chat', modal.attr('UUID'), {
						title: username,
						touid: data.message.fromUser.uid
					});
				}
			} else {
				module.createModal({
					username: username,
					touid: data.withUid,
					silent: true
				}, function(modal) {
					module.toggleNew(modal.attr('UUID'), true, true);
					if (!isSelf) {
						app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
						sounds.play('chat-incoming');
					}
				});
			}
		});

		socket.on('event:chats.userStartTyping', function(withUid) {
			var modal = module.getModal(withUid);
			var chatContent = modal.find('.chat-content');
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

	module.loadChatsDropdown = function(chatsListEl) {
		var dropdownEl;

		socket.emit('modules.chats.getRecentChats', {after: 0}, function(err, chats) {
			if (err) {
				return app.alertError(err.message);
			}
			chats = chats.users;

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

			chats.forEach(function(userObj) {
				dropdownEl = $('<li class="' + (userObj.unread ? 'unread' : '') + '"/>')
					.attr('data-uid', userObj.uid)
					.html('<a data-ajaxify="false">'+
						(userObj.picture ?
							'<img src="' +	userObj.picture + '" title="' +	userObj.username +'" />' :
							'<div class="user-icon" style="background-color: ' + userObj['icon:bgColor'] + '">' + userObj['icon:text'] + '</div>') +
						'<i class="fa fa-circle status ' + userObj.status + '"></i> ' +
						userObj.username + '</a>')
					.appendTo(chatsListEl);


				dropdownEl.click(function() {
					if (!ajaxify.currentPage.match(/^chats\//)) {
						app.openChat(userObj.username, userObj.uid);
					} else {
						ajaxify.go('chats/' + utils.slugify(userObj.username));
					}
				});
			});
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

	module.createModal = function(data, callback) {
		templates.parse('chat', {}, function(chatTpl) {
			translator.translate(chatTpl, function (chatTpl) {

				var chatModal = $(chatTpl),
					uuid = utils.generateUUID(),
					dragged = false;

				chatModal.attr('id', 'chat-modal-' + data.touid);
				chatModal.attr('touid', data.touid);
				chatModal.attr('intervalId', 0);
				chatModal.attr('UUID', uuid);
				chatModal.css('position', 'fixed');
				chatModal.css('zIndex', 100);
				chatModal.appendTo($('body'));
				module.center(chatModal);

				app.loadJQueryUI(function() {
					chatModal.find('.modal-content').resizable({
						minHeight: 250,
						minWidth: 400
					});

					chatModal.find('.modal-content').on('resize', function(event, ui) {
						if (ui.originalSize.height === ui.size.height) {
							return;
						}

						chatModal.find('.chat-content').css('height', module.calculateChatListHeight(chatModal));
					});

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
				});

				chatModal.find('#chat-with-name').html(data.username);

				chatModal.find('#chat-close-btn').on('click', function() {
					module.close(chatModal);
				});

				function gotoChats() {
					var text = components.get('chat/input').val();
					$(window).one('action:ajaxify.end', function() {
						components.get('chat/input').val(text);
					});

					ajaxify.go('chats/' + utils.slugify(data.username));
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
						socket.emit('modules.chats.markRead', data.touid);
						newMessage = false;
					}
				});

				Chats.addSinceHandler(chatModal.attr('touid'), chatModal.find('.chat-content'), chatModal.find('[data-since]'));

				Chats.addSendHandlers(chatModal.attr('touid'), chatModal.find('#chat-message-input'), chatModal.find('#chat-message-send-btn'));

				Chats.loadChatSince(chatModal.attr('touid'), chatModal.find('.chat-content'), 'recent');

				checkStatus(chatModal);

				module.canMessage(data.touid, function(err) {
					if (err) {
						// Disable the text input
						chatModal.find('input[type="text"]').attr('disabled', true);
					}
				});

				taskbar.push('chat', chatModal.attr('UUID'), {
					title: data.username,
					touid: data.touid,
					icon: 'fa-comment',
					state: ''
				});

				$(window).trigger('action:chat.loaded', chatModal);

				if (typeof callback === 'function') {
					callback(chatModal);
				}
			});
		});
	};

	module.focusInput = function(chatModal) {
		chatModal.find('#chat-message-input').focus();
	};

	module.close = function(chatModal, silent) {
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
		Chats.scrollToBottom(chatModal.find('.chat-content'));
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
		var messagesEl = modalEl.find('.chat-content');
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
			contentMargin = parseInt(modalEl.find('.chat-content').css('margin-top'), 10) + parseInt(modalEl.find('.chat-content').css('margin-bottom'), 10),
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

	module.toggleNew = taskbar.toggleNew;

	module.canMessage = function(toUid, callback) {
		socket.emit('modules.chats.canMessage', toUid, callback);
	};



	return module;
});
