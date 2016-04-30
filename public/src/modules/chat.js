"use strict";
/* globals app, define, socket, templates, utils, ajaxify */

define('chat', [
	'components',
	'taskbar',
	'string',
	'sounds',
	'forum/chats',
	'forum/chats/messages',
	'translator'
], function(components, taskbar, S, sounds, Chats, ChatsMessages, translator) {

	var module = {};
	var newMessage = false;

	module.prepareDOM = function() {
		var chatsToggleEl = components.get('chat/dropdown');
		var chatsListEl = components.get('chat/list');

		chatsToggleEl.on('click', function() {
			if (chatsToggleEl.parent().hasClass('open')) {
				return;
			}

			module.loadChatsDropdown(chatsListEl);
		});

		$('[component="chats/mark-all-read"]').on('click', function() {
			socket.emit('modules.chats.markAllRead', function(err) {
				if (err) {
					return app.alertError(err);
				}
			});
		});

		socket.on('event:chats.receive', function(data) {
			var username = data.message.fromUser.username;
			var isSelf = data.self === 1;
			data.message.self = data.self;

			newMessage = data.self === 0;
			if (module.modalExists(data.roomId)) {
				var modal = module.getModal(data.roomId);

				ChatsMessages.appendChatMessage(modal.find('.chat-content'), data.message);

				if (modal.is(':visible')) {
					taskbar.updateActive(modal.attr('UUID'));
					ChatsMessages.scrollToBottom(modal.find('.chat-content'));
				} else {
					module.toggleNew(modal.attr('UUID'), true, true);
				}

				if (!isSelf && (!modal.is(':visible') || !app.isFocused)) {
					app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
					sounds.play('chat-incoming');

					taskbar.push('chat', modal.attr('UUID'), {
						title: username,
						touid: data.message.fromUser.uid,
						roomId: data.roomId
					});
				}
			} else {
				socket.emit('modules.chats.loadRoom', {roomId: data.roomId}, function(err, roomData) {
					if (err) {
						return app.alertError(err.message);
					}
					roomData.users = roomData.users.filter(function(user) {
						return user && parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
					});
					roomData.silent = true;
					module.createModal(roomData, function(modal) {
						module.toggleNew(modal.attr('UUID'), !isSelf, true);
						if (!isSelf) {
							app.alternatingTitle('[[modules:chat.user_has_messaged_you, ' + username + ']]');
							sounds.play('chat-incoming');
						}
					});
				});
			}
		});

		socket.on('event:user_status_change', function(data) {
			var modal = module.getModal(data.uid);
			app.updateUserStatus(modal.find('[component="user/status"]'), data.status);
		});

		socket.on('event:chats.roomRename', function(data) {
			module.getModal(data.roomId).find('[component="chat/room/name"]').val($('<div/>').html(data.newName).text());
		});

		ChatsMessages.onChatMessageEdit();
	};

	module.loadChatsDropdown = function(chatsListEl) {
		socket.emit('modules.chats.getRecentChats', {after: 0}, function(err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			var rooms = data.rooms.filter(function(room) {
			    return room.teaser;
			});

			chatsListEl.empty();

			if (!rooms.length) {
				translator.translate('[[modules:chat.no_active]]', function(str) {
					$('<li />')
						.addClass('no_active')
						.html('<a href="#">' + str + '</a>')
						.appendTo(chatsListEl);
				});
				return;
			}

			rooms.forEach(function(roomObj) {
				function createUserImage(userObj) {
					return '<a data-ajaxify="false">' +
						(userObj.picture ?
							'<img src="' +	userObj.picture + '" title="' +	userObj.username +'" />' :
							'<div class="user-icon" style="background-color: ' + userObj['icon:bgColor'] + '">' + userObj['icon:text'] + '</div>') +
						'<i class="fa fa-circle status ' + userObj.status + '"></i> ' +
						roomObj.usernames + '</a>';
				}

				var dropdownEl = $('<li class="' + (roomObj.unread ? 'unread' : '') + '"/>')
					.attr('data-roomId', roomObj.roomId)
					.appendTo(chatsListEl);

				if (roomObj.lastUser) {
					dropdownEl.append(createUserImage(roomObj.lastUser));
				} else {
					translator.translate('[[modules:chat.no-users-in-room]]', function(str) {
						dropdownEl.append(str);
					});
				}

				dropdownEl.click(function() {
					if (!ajaxify.currentPage.match(/^chats\//)) {
						app.openChat(roomObj.roomId);
					} else {
						ajaxify.go('chats/' + roomObj.roomId);
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

	module.getModal = function(roomId) {
		return $('#chat-modal-' + roomId);
	};

	module.modalExists = function(roomId) {
		return $('#chat-modal-' + roomId).length !== 0;
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
		templates.parse('chat', data, function(chatTpl) {
			translator.translate(chatTpl, function (chatTpl) {

				var chatModal = $(chatTpl),
					uuid = utils.generateUUID(),
					dragged = false;

				chatModal.attr('id', 'chat-modal-' + data.roomId);
				chatModal.attr('roomId', data.roomId);
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

				chatModal.find('#chat-close-btn').on('click', function() {
					module.close(chatModal);
				});

				function gotoChats() {
					var text = components.get('chat/input').val();
					$(window).one('action:ajaxify.end', function() {
						components.get('chat/input').val(text);
					});

					ajaxify.go('chats/' + chatModal.attr('roomId'));
					module.close(chatModal);
				}

				chatModal.find('.modal-header').on('dblclick', gotoChats);
				chatModal.find('button[data-action="maximize"]').on('click', gotoChats);

				chatModal.on('click', function() {
					module.bringModalToTop(chatModal);

					if (dragged) {
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
						socket.emit('modules.chats.markRead', data.roomId);
						newMessage = false;
					}
				});

				Chats.addEditDeleteHandler(chatModal.find('[component="chat/messages"]'), data.roomId);

				chatModal.find('[component="chat/controlsToggle"]').on('click', function() {
					var messagesEl = chatModal.find('[component="chat/messages"]');

					chatModal.find('[component="chat/controls"]').toggle();
					messagesEl.css('height', module.calculateChatListHeight(chatModal));
				});

				Chats.addSinceHandler(chatModal.attr('roomId'), chatModal.find('.chat-content'), chatModal.find('[data-since]'));
				Chats.addRenameHandler(chatModal.attr('roomId'), chatModal.find('[component="chat/room/name"]'));

				Chats.addSendHandlers(chatModal.attr('roomId'), chatModal.find('#chat-message-input'), chatModal.find('#chat-message-send-btn'));

				Chats.createTagsInput(chatModal.find('.users-tag-input'), data);
				Chats.createAutoComplete(chatModal.find('[component="chat/input"]'));

				Chats.loadChatSince(chatModal.attr('roomId'), chatModal.find('.chat-content'), 'recent');

				checkStatus(chatModal);

				taskbar.push('chat', chatModal.attr('UUID'), {
					title: data.users.length ? data.users[0].username : '',
					roomId: data.roomId,
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

	module.close = function(chatModal) {
		clearInterval(chatModal.attr('intervalId'));
		chatModal.attr('intervalId', 0);
		chatModal.remove();
		chatModal.data('modal', null);
		taskbar.discard('chat', chatModal.attr('UUID'));

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
		var chatModal = $('div[UUID="' + uuid + '"]');
		chatModal.removeClass('hide');
		checkStatus(chatModal);
		taskbar.updateActive(uuid);
		ChatsMessages.scrollToBottom(chatModal.find('.chat-content'));
		module.bringModalToTop(chatModal);
		module.focusInput(chatModal);
		socket.emit('modules.chats.markRead', chatModal.attr('roomId'));

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
		var totalHeight = modalEl.find('.modal-content').outerHeight() - modalEl.find('.modal-header').outerHeight();
		var padding = parseInt(modalEl.find('.modal-body').css('padding-top'), 10) + parseInt(modalEl.find('.modal-body').css('padding-bottom'), 10);
		var contentMargin = parseInt(modalEl.find('.chat-content').css('margin-top'), 10) + parseInt(modalEl.find('.chat-content').css('margin-bottom'), 10);
		var sinceHeight = modalEl.find('.since-bar').outerHeight(true);
		var inputGroupHeight = modalEl.find('.input-group').outerHeight();

		return totalHeight - padding - contentMargin - inputGroupHeight;
	};

	module.minimize = function(uuid) {
		var chatModal = $('div[UUID="' + uuid + '"]');
		chatModal.addClass('hide');
		taskbar.minimize('chat', uuid);
		clearInterval(chatModal.attr('intervalId'));
		chatModal.attr('intervalId', 0);
	};

	module.toggleNew = taskbar.toggleNew;


	return module;
});
