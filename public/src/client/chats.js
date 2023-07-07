'use strict';


define('forum/chats', [
	'components',
	'mousetrap',
	'forum/chats/recent',
	'forum/chats/create',
	'forum/chats/manage',
	'forum/chats/messages',
	'forum/chats/user-list',
	'composer/autocomplete',
	'hooks',
	'bootbox',
	'alerts',
	'chat',
	'api',
	'uploadHelpers',
], function (
	components, mousetrap,
	recentChats, create, manage, messages,
	userList, autocomplete, hooks, bootbox,
	alerts, chatModule, api, uploadHelpers
) {
	const Chats = {
		initialised: false,
		activeAutocomplete: {},
	};

	let newMessage = false;
	let chatNavWrapper = null;

	$(window).on('action:ajaxify.start', function () {
		Chats.destroyAutoComplete(ajaxify.data.roomId);
		socket.emit('modules.chats.leave', ajaxify.data.roomId);
		socket.emit('modules.chats.leavePublic', ajaxify.data.publicRooms.map(r => r.roomId));
	});

	Chats.init = function () {
		$('.chats-full [data-bs-toggle="tooltip"]').tooltip();
		socket.emit('modules.chats.enterPublic', ajaxify.data.publicRooms.map(r => r.roomId));
		const env = utils.findBootstrapEnvironment();
		chatNavWrapper = $('[component="chat/nav-wrapper"]');

		if (!Chats.initialised) {
			Chats.addSocketListeners();
			Chats.addGlobalEventListeners();
		}

		recentChats.init();

		Chats.addEventListeners();
		Chats.setActive();

		if (env === 'md' || env === 'lg' || env === 'xl' || env === 'xxl') {
			Chats.addHotkeys();
		}

		Chats.initialised = true;
		messages.scrollToBottom($('.expanded-chat ul.chat-content'));
		messages.wrapImagesInLinks($('.expanded-chat ul.chat-content'));
		create.init();

		hooks.fire('action:chat.loaded', $('.chats-full'));
	};

	Chats.addEventListeners = function () {
		Chats.addSendHandlers(ajaxify.data.roomId, $('.chat-input'), $('.expanded-chat button[data-action="send"]'));
		Chats.addPopoutHandler();
		Chats.addActionHandlers(components.get('chat/messages'), ajaxify.data.roomId);
		Chats.addManageHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="members"]'));
		Chats.addRenameHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="rename"]'));
		Chats.addLeaveHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="leave"]'));
		Chats.addDeleteHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="delete"]'));
		Chats.addScrollHandler(ajaxify.data.roomId, ajaxify.data.uid, $('.chat-content'));
		Chats.addScrollBottomHandler($('.chat-content'));
		Chats.addCharactersLeftHandler($('[component="chat/main-wrapper"]'));
		Chats.addTextareaResizeHandler($('[component="chat/main-wrapper"]'));
		Chats.addIPHandler($('[component="chat/main-wrapper"]'));
		Chats.createAutoComplete(ajaxify.data.roomId, $('[component="chat/input"]'));
		Chats.addUploadHandler({
			dragDropAreaEl: $('.chats-full'),
			pasteEl: $('[component="chat/input"]'),
			uploadFormEl: $('[component="chat/upload"]'),
			uploadBtnEl: $('[component="chat/upload/button"]'),
			inputEl: $('[component="chat/input"]'),
		});

		$('[data-action="close"]').on('click', function () {
			Chats.switchChat();
		});
		userList.init(ajaxify.data.roomId, $('[component="chat/main-wrapper"]'));
		Chats.addPublicRoomSortHandler();
	};

	Chats.addPublicRoomSortHandler = function () {
		if (app.user.isAdmin && !utils.isMobile()) {
			app.loadJQueryUI(() => {
				const publicRoomList = $('[component="chat/public"]');
				publicRoomList.sortable({
					handle: '[component="chat/public/room/sort/handle"]',
					axis: 'y',
					update: async function () {
						const data = { roomIds: [], scores: [] };
						publicRoomList.find('[data-roomid]').each((idx, el) => {
							data.roomIds.push($(el).attr('data-roomid'));
							data.scores.push(idx);
						});
						await socket.emit('modules.chats.sortPublicRooms', data);
					},
				});
			});
		}
	};

	Chats.addUploadHandler = function (options) {
		uploadHelpers.init({
			dragDropAreaEl: options.dragDropAreaEl,
			pasteEl: options.pasteEl,
			uploadFormEl: options.uploadFormEl,
			uploadBtnEl: options.uploadBtnEl,
			route: '/api/post/upload', // using same route as post uploads
			callback: function (uploads) {
				const inputEl = options.inputEl;
				let text = inputEl.val();
				uploads.forEach((upload) => {
					text = text + (!text.endsWith('\n') ? '\n' : '') + (upload.isImage ? '!' : '') + `[${upload.filename}](${upload.url})\n`;
				});
				inputEl.val(text).trigger('input');
			},
		});
	};

	Chats.addIPHandler = function (container) {
		container.on('click', '.chat-ip-button', async function () {
			const ipEl = $(this);
			let ip = ipEl.attr('data-ip');
			if (ip) {
				navigator.clipboard.writeText(ip);
				ipEl.translateText('[[global:copied]]');
				setTimeout(() => ipEl.text(ip), 2000);
				return;
			}
			const mid = ipEl.parents('[data-mid]').attr('data-mid');
			ip = await socket.emit('modules.chats.getIP', mid);
			ipEl.text(ip).attr('data-ip', ip);
		});
	};

	Chats.addPopoutHandler = function () {
		$('[data-action="pop-out"]').on('click', function () {
			const text = components.get('chat/input').val();
			const roomId = ajaxify.data.roomId;

			if (app.previousUrl && app.previousUrl.match(/chats/)) {
				ajaxify.go('user/' + ajaxify.data.userslug + '/chats', function () {
					chatModule.openChat(roomId, ajaxify.data.uid);
				}, true);
			} else {
				window.history.go(-1);
				chatModule.openChat(roomId, ajaxify.data.uid);
			}

			$(window).one('action:chat.loaded', function () {
				components.get('chat/input').val(text);
			});
		});
	};

	Chats.addScrollHandler = function (roomId, uid, el) {
		let loading = false;
		el.off('scroll').on('scroll', utils.debounce(function () {
			messages.toggleScrollUpAlert(el);
			if (loading) {
				return;
			}

			const top = (el[0].scrollHeight - el.height()) * 0.1;
			if (el.scrollTop() >= top) {
				return;
			}
			loading = true;
			const start = parseInt(el.children('[data-mid]').length, 10);
			api.get(`/chats/${roomId}/messages`, { uid, start }).then((data) => {
				data = data.messages;

				if (!data) {
					loading = false;
					return;
				}
				data = data.filter(function (chatMsg) {
					return !$('[component="chat/message"][data-mid="' + chatMsg.messageId + '"]').length;
				});
				if (!data.length) {
					loading = false;
					return;
				}
				messages.parseMessage(data, function (html) {
					const currentScrollTop = el.scrollTop();
					const previousHeight = el[0].scrollHeight;
					el.prepend(html);
					messages.onMessagesAddedToDom(html);
					el.scrollTop((el[0].scrollHeight - previousHeight) + currentScrollTop);
					loading = false;
				});
			}).catch(alerts.error);
		}, 100));
	};

	Chats.addScrollBottomHandler = function (chatContent) {
		chatContent.parent()
			.find('[component="chat/messages/scroll-up-alert"]')
			.off('click').on('click', function () {
				messages.scrollToBottom(chatContent);
			});
	};

	Chats.addCharactersLeftHandler = function (parent) {
		const element = parent.find('[component="chat/input"]');
		element.on('change keyup paste', function () {
			messages.updateRemainingLength(parent);
		});
	};

	Chats.addTextareaResizeHandler = function (parent) {
		// https://stackoverflow.com/questions/454202/creating-a-textarea-with-auto-resize
		const textarea = parent.find('[component="chat/input"]');
		textarea.on('input', function () {
			const isAtBottom = messages.isAtBottom(parent.find('.chat-content'));
			textarea.css({ height: 0 });
			textarea.css({ height: messages.calcAutoTextAreaHeight(textarea) + 'px' });
			if (isAtBottom) {
				messages.scrollToBottom(parent.find('.chat-content'));
			}
		});
	};

	Chats.addActionHandlers = function (element, roomId) {
		element.on('click', '[data-mid] [data-action]', function () {
			const messageId = $(this).parents('[data-mid]').attr('data-mid');
			const action = this.getAttribute('data-action');

			switch (action) {
				case 'edit': {
					const inputEl = $('[data-roomid="' + roomId + '"] [component="chat/input"]');
					messages.prepEdit(inputEl, messageId, roomId);
					break;
				}
				case 'delete':
					messages.delete(messageId, roomId);
					break;

				case 'restore':
					messages.restore(messageId, roomId);
					break;
			}
		});
	};

	Chats.addHotkeys = function () {
		mousetrap.bind('ctrl+up', function () {
			const activeContact = $('.chats-list .active');
			const prev = activeContact.prevAll('[data-roomid]').first();
			if (prev.length && prev.attr('data-roomid')) {
				Chats.switchChat(prev.attr('data-roomid'));
			}
		});
		mousetrap.bind('ctrl+down', function () {
			const activeContact = $('.chats-list .active');
			const next = activeContact.nextAll('[data-roomid]').first();
			if (next.length && next.attr('data-roomid')) {
				Chats.switchChat(next.attr('data-roomid'));
			}
		});
		mousetrap.bind('up', function (e) {
			const inputEl = components.get('chat/input');
			if (e.target === inputEl.get(0) && !inputEl.val()) {
				// Retrieve message id from messages list
				const message = components.get('chat/messages').find('.chat-message[data-self="1"]').last();
				if (!message.length) {
					return;
				}
				const lastMid = message.attr('data-mid');
				messages.prepEdit(inputEl, lastMid, ajaxify.data.roomId);
			}
		});
	};

	Chats.addManageHandler = function (roomId, buttonEl) {
		manage.init(roomId, buttonEl);
	};

	Chats.addLeaveHandler = function (roomId, buttonEl) {
		buttonEl.on('click', function () {
			bootbox.confirm({
				size: 'small',
				title: '[[modules:chat.leave]]',
				message: '<p>[[modules:chat.leave-prompt]]</p><p class="form-text">[[modules:chat.leave-help]]</p>',
				callback: function (ok) {
					if (ok) {
						api.del(`/chats/${roomId}/users/${app.user.uid}`, {}).then(() => {
							// Return user to chats page. If modal, close modal.
							const modal = buttonEl.parents('.chat-modal');
							if (modal.length) {
								chatModule.close(modal);
							} else {
								Chats.destroyAutoComplete(roomId);
								ajaxify.go('chats');
							}
						}).catch(alerts.error);
					}
				},
			});
		});
	};

	Chats.addDeleteHandler = function (roomId, buttonEl) {
		buttonEl.on('click', function () {
			bootbox.confirm({
				size: 'small',
				title: '[[modules:chat.delete]]',
				message: '<p>[[modules:chat.delete-prompt]]</p>',
				callback: function (ok) {
					if (ok) {
						api.del(`/admin/chats/${roomId}`, {}).then(() => {
							// Return user to chats page. If modal, close modal.
							const modal = buttonEl.parents('.chat-modal');
							if (modal.length) {
								chatModule.close(modal);
							} else {
								Chats.destroyAutoComplete(roomId);
								ajaxify.go('chats');
							}
						}).catch(alerts.error);
					}
				},
			});
		});
	};

	Chats.addRenameHandler = function (roomId, buttonEl, roomName) {
		let modal;

		buttonEl.on('click', function () {
			app.parseAndTranslate('modals/rename-room', {
				name: roomName || ajaxify.data.roomName,
			}, function (html) {
				modal = bootbox.dialog({
					title: '[[modules:chat.rename-room]]',
					message: html,
					buttons: {
						save: {
							label: '[[global:save]]',
							className: 'btn-primary',
							callback: function () {
								api.put(`/chats/${roomId}`, {
									name: modal.find('#roomName').val(),
								}).catch(alerts.error);
							},
						},
					},
				});
			});
		});
	};

	Chats.addSendHandlers = function (roomId, inputEl, sendEl) {
		if (!utils.isMobile()) {
			inputEl.off('keypress').on('keypress', function (e) {
				if (e.which === 13 && !e.shiftKey) {
					messages.sendMessage(roomId, inputEl);
					return false;
				}
			});
		}

		sendEl.off('click').on('click', function () {
			messages.sendMessage(roomId, inputEl);
			inputEl.focus();
			return false;
		});
	};

	Chats.createAutoComplete = function (roomId, element, options = {}) {
		if (!element.length) {
			return;
		}

		const data = {
			element: element,
			strategies: [],
			options: {
				style: {
					'z-index': 20000,
					flex: 0,
					top: 'inherit',
				},
				placement: 'top',
				className: `chat-autocomplete-dropdown-${roomId} dropdown-menu textcomplete-dropdown`,
				...options,
			},
		};

		$(window).trigger('chat:autocomplete:init', data);
		if (data.strategies.length) {
			const autocompleteEl = autocomplete.setup(data);
			if (roomId) {
				Chats.activeAutocomplete[roomId] = autocompleteEl;
			}
			return autocompleteEl;
		}
	};

	Chats.destroyAutoComplete = function (roomId) {
		if (Chats.activeAutocomplete[roomId]) {
			Chats.activeAutocomplete[roomId].destroy();
			delete Chats.activeAutocomplete[roomId];
		}
	};

	Chats.leave = function (el) {
		const roomId = el.attr('data-roomid');
		api.del(`/chats/${roomId}/users/${app.user.uid}`, {}).then(() => {
			if (parseInt(roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				ajaxify.go('user/' + ajaxify.data.userslug + '/chats');
			} else {
				el.remove();
			}
			Chats.destroyAutoComplete(roomId);
			const modal = chatModule.getModal(roomId);
			if (modal.length) {
				chatModule.close(modal);
			}
		}).catch(alerts.error);
	};

	Chats.switchChat = function (roomid) {
		ajaxify.go('user/' + ajaxify.data.userslug + '/chats/' + (roomid || '') + window.location.search);
	};

	Chats.addGlobalEventListeners = function () {
		$(window).on('mousemove keypress click', function () {
			if (newMessage && ajaxify.data.roomId) {
				api.del(`/chats/${ajaxify.data.roomId}/state`, {});
				newMessage = false;
			}
		});
	};

	Chats.addSocketListeners = function () {
		socket.on('event:chats.receive', function (data) {
			if (chatModule.isFromBlockedUser(data.fromUid)) {
				return;
			}
			if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				data.self = parseInt(app.user.uid, 10) === parseInt(data.fromUid, 10) ? 1 : 0;
				if (!newMessage) {
					newMessage = data.self === 0;
				}
				data.message.self = data.self;
				data.message.timestamp = Math.min(Date.now(), data.message.timestamp);
				data.message.timestampISO = utils.toISOString(data.message.timestamp);
				messages.appendChatMessage($('.expanded-chat .chat-content'), data.message);
			}
		});

		socket.on('event:chats.public.unread', function (data) {
			if (
				chatModule.isFromBlockedUser(data.fromuid) ||
				chatModule.isLookingAtRoom(data.roomId) ||
				app.user.uid === parseInt(data.fromUid, 10)
			) {
				return;
			}
			Chats.markChatPageElUnread(data);
			Chats.increasePublicRoomUnreadCount(chatNavWrapper.find('[data-roomid=' + data.roomId + ']'));
		});

		socket.on('event:user_status_change', function (data) {
			app.updateUserStatus($('.chats-list [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
		});

		messages.addSocketListeners();

		socket.on('event:chats.roomRename', function (data) {
			const roomEl = components.get('chat/recent/room', data.roomId);
			if (roomEl.length) {
				const titleEl = roomEl.find('[component="chat/room/title"]');
				ajaxify.data.roomName = data.newName;
				titleEl.text(data.newName);
			}
		});

		socket.on('event:chats.mark', ({ roomId, state }) => {
			const roomEls = $(`[component="chat/recent"] [data-roomid="${roomId}"], [component="chat/list"] [data-roomid="${roomId}"], [component="chat/public"] [data-roomid="${roomId}"]`);
			roomEls.each((idx, el) => {
				const roomEl = $(el);
				chatModule.markChatElUnread(roomEl, state === 1);
				if (state === 0) {
					Chats.updatePublicRoomUnreadCount(roomEl, 0);
				}
			});
		});
	};

	Chats.markChatPageElUnread = function (data) {
		if (!ajaxify.data.template.chats) {
			return;
		}

		const roomEl = chatNavWrapper.find('[data-roomid=' + data.roomId + ']');
		chatModule.markChatElUnread(roomEl, true);
	};

	Chats.increasePublicRoomUnreadCount = function (roomEl) {
		const unreadCountEl = roomEl.find('[component="chat/public/room/unread/count"]');
		const newCount = (parseInt(unreadCountEl.attr('data-count'), 10) || 0) + 1;
		Chats.updatePublicRoomUnreadCount(roomEl, newCount);
	};

	Chats.updatePublicRoomUnreadCount = function (roomEl, count) {
		const unreadCountEl = roomEl.find('[component="chat/public/room/unread/count"]');
		const countText = count > 50 ? '50+' : count;
		unreadCountEl.toggleClass('hidden', count <= 0).text(countText).attr('data-count', count);
	};

	Chats.setActive = function () {
		chatNavWrapper.find('[data-roomid]').removeClass('active');
		if (ajaxify.data.roomId) {
			socket.emit('modules.chats.enter', ajaxify.data.roomId);
			const chatEl = chatNavWrapper.find(`[data-roomid="${ajaxify.data.roomId}"]`);
			chatEl.addClass('active');
			if (chatEl.hasClass('unread')) {
				api.del(`/chats/${ajaxify.data.roomId}/state`, {});
				chatEl.removeClass('unread');
			}

			if (!utils.isMobile()) {
				$('.expanded-chat [component="chat/input"]').focus();
			}
			messages.updateTextAreaHeight($(`[component="chat/messages"][data-roomid="${ajaxify.data.roomId}"]`));
		}

		chatNavWrapper.attr('data-loaded', ajaxify.data.roomId ? '1' : '0');
	};

	return Chats;
});

