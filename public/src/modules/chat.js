'use strict';

define('chat', [
	'components', 'taskbar', 'translator', 'hooks', 'bootbox', 'alerts', 'api', 'scrollStop',
], function (components, taskbar, translator, hooks, bootbox, alerts, api, scrollStop) {
	const module = {};

	module.openChat = function (roomId, uid) {
		if (!app.user.uid) {
			return alerts.error('[[error:not-logged-in]]');
		}

		function loadAndCenter(chatModal) {
			module.load(chatModal.attr('data-uuid'));
			module.center(chatModal);
			module.focusInput(chatModal);
		}
		hooks.fire('filter:chat.openChat', {
			modal: true,
			roomId: roomId,
			uid: uid,
		}).then((hookData) => {
			if (!hookData.modal) {
				return ajaxify.go(`/chats/${roomId}`);
			}
			if (module.modalExists(roomId)) {
				loadAndCenter(module.getModal(roomId));
			} else {
				api.get(`/chats/${roomId}`, {
					uid: uid || app.user.uid,
				}).then((roomData) => {
					roomData.users = roomData.users.filter(function (user) {
						return user && parseInt(user.uid, 10) !== parseInt(app.user.uid, 10);
					});
					roomData.uid = uid || app.user.uid;
					roomData.isSelf = true;
					module.createModal(roomData, loadAndCenter);
				}).catch(alerts.error);
			}
		});
	};

	module.newChat = function (touid, callback) {
		function createChat() {
			api.post(`/chats`, {
				uids: [touid],
			}).then(({ roomId }) => {
				if (!ajaxify.data.template.chats) {
					module.openChat(roomId);
				} else {
					ajaxify.go('chats/' + roomId);
				}

				callback(null, roomId);
			}).catch(alerts.error);
		}

		callback = callback || function () { };
		if (!app.user.uid) {
			return alerts.error('[[error:not-logged-in]]');
		}

		if (parseInt(touid, 10) === parseInt(app.user.uid, 10)) {
			return alerts.error('[[error:cant-chat-with-yourself]]');
		}

		// Skip dnd check for remote users
		if (!utils.isNumber(touid)) {
			return createChat();
		}

		api.get(`/users/${touid}/status`).then(({ status }) => {
			if (status !== 'dnd') {
				return createChat();
			}

			bootbox.confirm('[[modules:chat.confirm-chat-with-dnd-user]]', function (ok) {
				if (ok) {
					createChat();
				}
			});
		}).catch(alerts.error);
	};

	module.loadChatsDropdown = function (chatsListEl) {
		api.get('/chats', {
			uid: app.user.uid,
			after: 0,
		}).then((data) => {
			const rooms = data.rooms.map((room) => {
				if (room && room.teaser) {
					room.teaser.timeagoLong = $.timeago(new Date(parseInt(room.teaser.timestamp, 10)));
				}
				return room;
			});

			translator.toggleTimeagoShorthand(async function () {
				rooms.forEach((room) => {
					if (room && room.teaser) {
						room.teaser.timeago = $.timeago(new Date(parseInt(room.teaser.timestamp, 10)));
						room.teaser.timeagoShort = room.teaser.timeago;
					}
				});

				translator.toggleTimeagoShorthand();
				const html = await app.parseAndTranslate('partials/chats/dropdown', { rooms: rooms });
				const listEl = chatsListEl.get(0);

				chatsListEl.find('*').not('.navigation-link').remove();
				chatsListEl.prepend(html);
				chatsListEl.off('click').on('click', '[data-roomid]', function (ev) {
					if (['.user-link', '.mark-read'].some(className => ev.target.closest(className))) {
						return;
					}
					const roomId = $(this).attr('data-roomid');
					if (!ajaxify.currentPage.match(/^chats\//)) {
						module.openChat(roomId);
					} else {
						ajaxify.go('user/' + app.user.userslug + '/chats/' + roomId);
					}
				});

				listEl.removeEventListener('click', onMarkReadClicked);
				listEl.addEventListener('click', onMarkReadClicked);

				$('[component="chats/mark-all-read"]').off('click').on('click', async function () {
					const chatEls = document.querySelectorAll('[component="chat/list"] [data-roomid]');
					await Promise.all(Array.prototype.map.call(chatEls, async (el) => {
						const roomId = el.getAttribute('data-roomid');
						await api.del(`/chats/${roomId}/state`);
						if (ajaxify.data.template.chats) {
							module.markChatElUnread($(el), false);
						}
					}));
				});
			});
		}).catch(alerts.error);
	};

	function onMarkReadClicked(e) {
		const subselector = e.target.closest('.mark-read');
		if (!subselector) {
			return;
		}

		e.stopPropagation();
		const chatEl = e.target.closest('[data-roomid]');
		module.toggleReadState(chatEl);
	}

	module.toggleReadState = function (chatEl) {
		const state = !chatEl.classList.contains('unread'); // this is the new state
		const roomId = chatEl.getAttribute('data-roomid');
		api[state ? 'put' : 'del'](`/chats/${roomId}/state`, {}).catch((err) => {
			alerts.error(err);

			// Revert on failure
			module.markChatElUnread($(chatEl), !state);
		});

		// Immediate feedback
		module.markChatElUnread($(chatEl), state);
	};

	module.isFromBlockedUser = function (fromUid) {
		return app.user.blocks.includes(parseInt(fromUid, 10));
	};

	module.isLookingAtRoom = function (roomId) {
		return ajaxify.data.template.chats && parseInt(ajaxify.data.roomId, 10) === parseInt(roomId, 10);
	};

	module.markChatElUnread = function (roomEl, unread) {
		if (roomEl.length > 0) {
			roomEl.toggleClass('unread', unread);
			const markEl = roomEl.find('.mark-read');
			if (markEl.length) {
				markEl.find('.read').toggleClass('hidden', unread);
				markEl.find('.unread').toggleClass('hidden', !unread);
			}
		}
	};

	module.onChatMessageReceived = function (data) {
		if (app.user.blocks.includes(parseInt(data.fromUid, 10))) {
			return;
		}
		if (module.modalExists(data.roomId)) {
			const modal = module.getModal(data.roomId);
			const newMessage = parseInt(modal.attr('new-message'), 10) === 1;
			data.self = parseInt(app.user.uid, 10) === parseInt(data.fromUid, 10) ? 1 : 0;
			if (!newMessage) {
				modal.attr('new-message', data.self === 0 ? 1 : 0);
			}
			data.message.self = data.self;
			data.message.timestamp = Math.min(Date.now(), data.message.timestamp);
			data.message.timestampISO = utils.toISOString(data.message.timestamp);
			addMessageToModal(data);
		}
	};

	function addMessageToModal(data) {
		const modal = module.getModal(data.roomId);
		const username = data.message.fromUser.username;
		const isSelf = data.self === 1;
		require(['forum/chats/messages'], function (ChatsMessages) {
			// don't add if already added
			if (!modal.find('[data-mid="' + data.message.messageId + '"]').length) {
				ChatsMessages.appendChatMessage(modal.find('[component="chat/message/content"]'), data.message);
			}

			if (modal.is(':visible')) {
				taskbar.updateActive(modal.attr('data-uuid'));
				if (ChatsMessages.isAtBottom(modal.find('[component="chat/message/content"]'))) {
					ChatsMessages.scrollToBottomAfterImageLoad(modal.find('[component="chat/message/content"]'));
				}
			} else if (!ajaxify.data.template.chats) {
				module.toggleNew(modal.attr('data-uuid'), true, true);
			}

			if (!isSelf && (!modal.is(':visible') || !app.isFocused)) {
				taskbar.push('chat', modal.attr('data-uuid'), {
					title: '[[modules:chat.chatting-with]] ' + (data.roomName || username),
					touid: data.message.fromUser.uid,
					roomId: data.roomId,
					isSelf: false,
				});
			}
		});
	}

	module.onRoomRename = function (data) {
		const modal = module.getModal(data.roomId);
		const titleEl = modal.find('[component="chat/room/name"]');
		const icon = titleEl.attr('data-icon');
		if (titleEl.length) {
			titleEl.html(
				data.newName ?
					`<i class="fa ${icon} text-muted"></i> ${data.newName}` :
					data.chatWithMessage
			);
		}

		const newTitle = $('<div></div>').html(data.newName).text();
		taskbar.update('chat', modal.attr('data-uuid'), {
			title: newTitle,
		});
		hooks.fire('action:chat.renamed', Object.assign(data, {
			modal: modal,
		}));
	};

	module.onUserTyping = function (data) {
		if (data.uid === app.user.uid || module.isFromBlockedUser(data.uid)) {
			return;
		}
		const modal = module.getModal(data.roomId);
		if (modal.length) {
			module.updateTypingUserList(modal, data);
		}
	};

	module.updateTypingUserList = async function (container, { uid, username, typing }) {
		const typingEl = container.find(`[component="chat/composer/typing"]`);
		const typingUsersList = typingEl.find('[component="chat/composer/typing/users"]');
		const userEl = typingUsersList.find(`[data-uid="${uid}"]`);

		if (typing && !userEl.length) {
			$(`<div/>`).attr('data-uid', uid)
				.text(username)
				.appendTo(typingUsersList);
		} else if (!typing && userEl.length) {
			userEl.remove();
		}

		const usernames = [];
		typingUsersList.children().each((i, el) => {
			usernames.push($(el).text());
		});

		const typingTextEl = typingEl.find('[component="chat/composer/typing/text"]');
		const count = usernames.length > 3 ? 'n' : usernames.length;
		if (count) {
			const key = `modules:chat.user-typing-${count}`;
			const compiled = translator.compile.apply(null, [key, ...usernames]);
			typingTextEl.html(await translator.translate(compiled));
		}
		typingTextEl.toggleClass('hidden', !usernames.length);
	};

	module.getModal = function (roomId) {
		return $('#chat-modal-' + roomId);
	};

	module.modalExists = function (roomId) {
		return $('#chat-modal-' + roomId).length !== 0;
	};

	module.initWidget = function (roomId, chatModal) {
		require(['forum/chats', 'forum/chats/messages'], function (Chats, ChatsMessages) {
			socket.emit('modules.chats.enter', roomId);
			api.del(`/chats/${roomId}/state`, {});

			chatModal.find('.timeago').timeago();
			chatModal.find('[data-bs-toggle="tooltip"]').tooltip({
				trigger: 'hover', container: '#content',
			});
			ChatsMessages.wrapImagesInLinks(chatModal.find('[component="chat/messages"] .chat-content'));

			scrollStop.apply(chatModal.find('[component="chat/messages"] .chat-content'));

			chatModal.on('mousemove keypress click', function () {
				if (parseInt(chatModal.attr('new-message'), 10) === 1) {
					api.del(`/chats/${roomId}/state`, {});
					chatModal.removeAttr('new-message');
				}
			});

			Chats.addActionHandlers(chatModal.find('[component="chat/message/window"]'), roomId);
			Chats.addSendHandlers(roomId, chatModal.find('.chat-input'), chatModal.find('[data-action="send"]'));

			Chats.createAutoComplete(roomId, chatModal.find('[component="chat/input"]'));

			Chats.addScrollHandler(roomId, app.user.uid, chatModal.find('[component="chat/message/content"]'));
			Chats.addScrollBottomHandler(roomId, chatModal.find('[component="chat/message/content"]'));
			Chats.addParentHandler(chatModal.find('[component="chat/message/content"]'));
			Chats.addCharactersLeftHandler(chatModal);
			Chats.addTextareaResizeHandler(chatModal);
			Chats.addTypingHandler(chatModal, roomId);
			Chats.addIPHandler(chatModal);
			Chats.addTooltipHandler(chatModal);
			Chats.addUploadHandler({
				dragDropAreaEl: chatModal.find('.modal-content'),
				pasteEl: chatModal,
				uploadFormEl: chatModal.find('[component="chat/upload"]'),
				uploadBtnEl: chatModal.find('[component="chat/upload/button"]'),
				inputEl: chatModal.find('[component="chat/input"]'),
			});

			ChatsMessages.addSocketListeners();

			ChatsMessages.scrollToBottomAfterImageLoad(chatModal.find('.chat-content'));

			hooks.fire('action:chat.loaded', chatModal);
		});
	};

	module.createModal = function (data, callback) {
		callback = callback || function () {};
		require([
			'forum/chats', 'forum/chats/messages', 'forum/chats/message-search',
		], function (Chats, ChatsMessages, messageSearch) {
			app.parseAndTranslate('chat', data, function (chatModal) {
				const roomId = data.roomId;
				if (module.modalExists(roomId)) {
					return callback(module.getModal(data.roomId));
				}
				const uuid = utils.generateUUID();
				let dragged = false;

				chatModal.attr('id', 'chat-modal-' + roomId);
				chatModal.attr('data-roomid', roomId);
				chatModal.attr('data-uuid', uuid);
				chatModal.css('position', 'fixed');
				chatModal.appendTo($('body'));
				chatModal.find('.timeago').timeago();
				chatModal.find('[data-bs-toggle="tooltip"]').tooltip({ trigger: 'hover', container: '#content' });
				ChatsMessages.wrapImagesInLinks(chatModal.find('[component="chat/messages"] .chat-content'));

				scrollStop.apply(chatModal.find('[component="chat/messages"] .chat-content'));

				module.center(chatModal);

				makeModalResizeableDraggable(chatModal, uuid);

				chatModal.find('#chat-close-btn').on('click', function () {
					module.close(uuid);
				});

				function gotoChats() {
					const text = components.get('chat/input').val();
					$(window).one('action:ajaxify.end', function () {
						components.get('chat/input').val(text);
					});

					ajaxify.go(`user/${app.user.userslug}/chats/${roomId}`);
					module.close(uuid);
				}

				chatModal.find('.modal-header').on('dblclick', gotoChats);
				chatModal.find('button[data-action="maximize"]').on('click', gotoChats);
				chatModal.find('button[data-action="minimize"]').on('click', function () {
					const uuid = chatModal.attr('data-uuid');
					module.minimize(uuid);
				});

				chatModal.on('mouseup', function () {
					taskbar.updateActive(chatModal.attr('data-uuid'));

					if (dragged) {
						dragged = false;
					}
				});

				chatModal.on('mousemove', function (e) {
					if (e.which === 1) {
						dragged = true;
					}
				});

				chatModal.on('mousemove keypress click', function () {
					if (parseInt(chatModal.attr('new-message'), 10) === 1) {
						api.del(`/chats/${roomId}/state`, {});
						chatModal.removeAttr('new-message');
					}
				});

				Chats.addActionHandlers(chatModal.find('[component="chat/message/window"]'), roomId);
				Chats.addRenameHandler(roomId, chatModal.find('[data-action="rename"]'));
				Chats.addLeaveHandler(roomId, chatModal.find('[data-action="leave"]'));
				Chats.addDeleteHandler(roomId, chatModal.find('[data-action="delete"]'));
				Chats.addSendHandlers(roomId, chatModal.find('.chat-input'), chatModal.find('[data-action="send"]'));
				Chats.addManageHandler(roomId, chatModal.find('[data-action="manage"]'));

				Chats.createAutoComplete(roomId, chatModal.find('[component="chat/input"]'));

				Chats.addScrollHandler(roomId, data.uid, chatModal.find('[component="chat/message/content"]'));
				Chats.addScrollBottomHandler(roomId, chatModal.find('[component="chat/message/content"]'));
				Chats.addParentHandler(chatModal.find('[component="chat/message/content"]'));
				Chats.addCharactersLeftHandler(chatModal);
				Chats.addTextareaResizeHandler(chatModal);
				Chats.addTypingHandler(chatModal, roomId);
				Chats.addIPHandler(chatModal);
				Chats.addTooltipHandler(chatModal);
				Chats.addUploadHandler({
					dragDropAreaEl: chatModal.find('.modal-content'),
					pasteEl: chatModal,
					uploadFormEl: chatModal.find('[component="chat/upload"]'),
					uploadBtnEl: chatModal.find('[component="chat/upload/button"]'),
					inputEl: chatModal.find('[component="chat/input"]'),
				});

				ChatsMessages.addSocketListeners();
				messageSearch.init(roomId, chatModal);
				Chats.addNotificationSettingHandler(roomId, chatModal);

				taskbar.push('chat', chatModal.attr('data-uuid'), {
					title: '[[modules:chat.chatting-with]] ' + (data.roomName || (data.users.length ? data.users[0].username : '')),
					roomId: data.roomId,
					icon: 'fa-comment',
					state: '',
					isSelf: data.isSelf,
				}, function () {
					taskbar.toggleNew(chatModal.attr('data-uuid'), !data.isSelf);
					hooks.fire('action:chat.loaded', chatModal);

					if (typeof callback === 'function') {
						callback(chatModal);
					}
				});
			});
		});
	};

	function makeModalResizeableDraggable(chatModal, uuid) {
		app.loadJQueryUI(function () {
			chatModal.find('.modal-content').resizable({
				handles: 'n, e, s, w, se',
				minHeight: 250,
				minWidth: 400,
			});

			chatModal.find('.modal-content').on('resize', function (event, ui) {
				if (ui.originalSize.height === ui.size.height) {
					return;
				}

				chatModal.find('.modal-body').css('height', module.calculateChatListHeight(chatModal));
			});

			chatModal.draggable({
				start: function () {
					taskbar.updateActive(uuid);
					chatModal.css({ bottom: 'auto', right: 'auto' });
				},
				stop: function () {
					module.focusInput(chatModal);
				},
				distance: 10,
				handle: '.modal-header',
			});
		});
	}

	module.focusInput = function (chatModal) {
		setTimeout(function () {
			chatModal.find('[component="chat/input"]').focus();
		}, 20);
	};

	module.close = function (uuid) {
		const chatModal = $('.chat-modal[data-uuid="' + uuid + '"]');
		chatModal.remove();
		chatModal.data('modal', null);
		taskbar.discard('chat', uuid);

		if (chatModal.attr('data-mobile')) {
			module.disableMobileBehaviour(chatModal);
		}
		const roomId = chatModal.attr('data-roomid');
		require(['forum/chats'], function (chats) {
			chats.destroyAutoComplete(roomId);
		});
		socket.emit('modules.chats.leave', roomId);
		hooks.fire('action:chat.closed', {
			uuid: uuid,
			modal: chatModal,
		});
	};

	module.center = function (chatModal) {
		const center = chatModal.attr('data-center');
		if (!center || center === 'false') {
			return;
		}
		let hideAfter = false;
		if (chatModal.hasClass('hide')) {
			chatModal.removeClass('hide');
			hideAfter = true;
		}
		chatModal.css('left', Math.max(0, (($(window).width() - $(chatModal).outerWidth()) / 2) + $(window).scrollLeft()) + 'px');
		chatModal.css('top', Math.max(0, ($(window).height() / 2) - ($(chatModal).outerHeight() / 2)) + 'px');

		if (hideAfter) {
			chatModal.addClass('hide');
		}
		return chatModal;
	};

	module.load = function (uuid) {
		require(['forum/chats/messages'], function (ChatsMessages) {
			const chatModal = $('.chat-modal[data-uuid="' + uuid + '"]');
			chatModal.removeClass('hide');
			taskbar.updateActive(uuid);
			ChatsMessages.scrollToBottomAfterImageLoad(chatModal.find('.chat-content'));
			module.focusInput(chatModal);
			const roomId = chatModal.attr('data-roomid');
			api.del(`/chats/${roomId}/state`, {});
			socket.emit('modules.chats.enter', roomId);
			const env = utils.findBootstrapEnvironment();
			if (env === 'xs' || env === 'sm') {
				module.enableMobileBehaviour(chatModal);
			}
		});
	};

	module.enableMobileBehaviour = function (modalEl) {
		app.toggleNavbar(false);
		modalEl.attr('data-mobile', '1');
		const messagesEl = modalEl.find('.modal-body');
		messagesEl.css('height', module.calculateChatListHeight(modalEl));
		function resize() {
			messagesEl.css('height', module.calculateChatListHeight(modalEl));
			require(['forum/chats/messages'], function (ChatsMessages) {
				ChatsMessages.scrollToBottom(modalEl.find('.chat-content'));
			});
		}

		$(window).on('resize', resize);
		$(window).one('action:ajaxify.start', function () {
			module.close(modalEl.attr('data-uuid'));
			$(window).off('resize', resize);
		});
	};

	module.disableMobileBehaviour = function () {
		app.toggleNavbar(true);
	};

	module.calculateChatListHeight = function (modalEl) {
		// Formula: modal height minus header height. Simple(tm).
		return modalEl.find('.modal-content').outerHeight() - modalEl.find('.modal-header').outerHeight();
	};

	module.minimize = function (uuid) {
		const chatModal = $('.chat-modal[data-uuid="' + uuid + '"]');
		chatModal.addClass('hide');
		taskbar.minimize('chat', uuid);
		hooks.fire('action:chat.minimized', {
			uuid: uuid,
			modal: chatModal,
		});
	};

	module.toggleNew = taskbar.toggleNew;

	return module;
});
