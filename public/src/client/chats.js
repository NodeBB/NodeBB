'use strict';


define('forum/chats', [
	'components',
	'translator',
	'mousetrap',
	'forum/chats/recent',
	'forum/chats/search',
	'forum/chats/messages',
	'composer/autocomplete',
	'hooks',
	'bootbox',
	'alerts',
	'chat',
	'api',
	'uploadHelpers',
], function (
	components, translator, mousetrap,
	recentChats, search, messages,
	autocomplete, hooks, bootbox, alerts, chatModule,
	api, uploadHelpers
) {
	const Chats = {
		initialised: false,
		activeAutocomplete: {},
	};

	let newMessage = false;

	$(window).on('action:ajaxify.start', function () {
		Chats.destroyAutoComplete(ajaxify.data.roomId);
	});

	Chats.init = function () {
		const env = utils.findBootstrapEnvironment();

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

		$(document).ready(function () {
			hooks.fire('action:chat.loaded', $('.chats-full'));
		});

		Chats.initialised = true;
		messages.scrollToBottom($('.expanded-chat ul.chat-content'));
		messages.wrapImagesInLinks($('.expanded-chat ul.chat-content'));
		search.init();
	};

	Chats.addEventListeners = function () {
		Chats.addSendHandlers(ajaxify.data.roomId, $('.chat-input'), $('.expanded-chat button[data-action="send"]'));
		Chats.addPopoutHandler();
		Chats.addActionHandlers(components.get('chat/messages'), ajaxify.data.roomId);
		Chats.addMemberHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="members"]'));
		Chats.addRenameHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="rename"]'));
		Chats.addLeaveHandler(ajaxify.data.roomId, components.get('chat/controls').find('[data-action="leave"]'));
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
		el.off('scroll').on('scroll', function () {
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
		});
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
		element.on('click', '[data-action]', function () {
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
			const activeContact = $('.chats-list .bg-info');
			const prev = activeContact.prev();

			if (prev.length) {
				Chats.switchChat(prev.attr('data-roomid'));
			}
		});
		mousetrap.bind('ctrl+down', function () {
			const activeContact = $('.chats-list .bg-info');
			const next = activeContact.next();

			if (next.length) {
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

	Chats.addMemberHandler = function (roomId, buttonEl) {
		let modal;

		buttonEl.on('click', function () {
			app.parseAndTranslate('modals/manage-room', {}, function (html) {
				modal = bootbox.dialog({
					title: '[[modules:chat.manage-room]]',
					message: html,
				});

				modal.attr('component', 'chat/manage-modal');

				Chats.refreshParticipantsList(roomId, modal);
				Chats.addKickHandler(roomId, modal);

				const searchInput = modal.find('input');
				const errorEl = modal.find('.text-danger');
				require(['autocomplete', 'translator'], function (autocomplete, translator) {
					autocomplete.user(searchInput, function (event, selected) {
						errorEl.text('');
						api.post(`/chats/${roomId}/users`, {
							uids: [selected.item.user.uid],
						}).then((body) => {
							Chats.refreshParticipantsList(roomId, modal, body);
							searchInput.val('');
						}).catch((err) => {
							translator.translate(err.message, function (translated) {
								errorEl.text(translated);
							});
						});
					});
				});
			});
		});
	};

	Chats.addKickHandler = function (roomId, modal) {
		modal.on('click', '[data-action="kick"]', function () {
			const uid = parseInt(this.getAttribute('data-uid'), 10);

			api.del(`/chats/${roomId}/users/${uid}`, {}).then((body) => {
				Chats.refreshParticipantsList(roomId, modal, body);
			}).catch(alerts.error);
		});
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

	Chats.refreshParticipantsList = async (roomId, modal, data) => {
		const listEl = modal.find('.list-group');

		if (!data) {
			try {
				data = await api.get(`/chats/${roomId}/users`, {});
			} catch (err) {
				translator.translate('[[error:invalid-data]]', function (translated) {
					listEl.find('li').text(translated);
				});
			}
		}

		app.parseAndTranslate('partials/chats/manage-room-users', data, function (html) {
			listEl.html(html);
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
							callback: submit,
						},
					},
				});
			});
		});

		function submit() {
			api.put(`/chats/${roomId}`, {
				name: modal.find('#roomName').val(),
			}).catch(alerts.error);
		}
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
		// Allow empty arg for return to chat list/close chat
		if (!roomid) {
			roomid = '';
		}
		Chats.destroyAutoComplete(ajaxify.data.roomId);
		const url = 'user/' + ajaxify.data.userslug + '/chats/' + roomid + window.location.search;
		if (self.fetch) {
			fetch(config.relative_path + '/api/' + url, { credentials: 'include' })
				.then(function (response) {
					if (response.ok) {
						response.json().then(function (payload) {
							app.parseAndTranslate('partials/chats/message-window', payload, function (html) {
								components.get('chat/main-wrapper').html(html);
								html.find('.timeago').timeago();
								ajaxify.data = payload;
								Chats.setActive();
								Chats.addEventListeners();
								hooks.fire('action:chat.loaded', $('.chats-full'));
								messages.scrollToBottom($('.expanded-chat ul.chat-content'));
								if (history.pushState) {
									history.pushState({
										url: url,
									}, null, window.location.protocol + '//' + window.location.host + config.relative_path + '/' + url);
								}
							});
						});
					} else {
						console.warn('[search] Received ' + response.status);
					}
				})
				.catch(function (error) {
					console.warn('[search] ' + error.message);
				});
		} else {
			ajaxify.go(url);
		}
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
			if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				if (!newMessage) {
					newMessage = data.self === 0;
				}
				data.message.self = data.self;
				data.message.timestamp = Math.min(Date.now(), data.message.timestamp);
				data.message.timestampISO = utils.toISOString(data.message.timestamp);
				messages.appendChatMessage($('.expanded-chat .chat-content'), data.message);
			} else if (ajaxify.data.template.chats) {
				const roomEl = $('[data-roomid=' + data.roomId + ']');

				if (roomEl.length > 0) {
					roomEl.addClass('unread');

					const markEl = roomEl.find('.mark-read').get(0);
					if (markEl) {
						markEl.querySelector('.read').classList.add('hidden');
						markEl.querySelector('.unread').classList.remove('hidden');
					}
				} else {
					const recentEl = components.get('chat/recent');
					app.parseAndTranslate('partials/chats/recent_room', {
						rooms: {
							roomId: data.roomId,
							lastUser: data.message.fromUser,
							usernames: data.message.fromUser.username,
							unread: true,
						},
					}, function (html) {
						recentEl.prepend(html);
					});
				}
			}
		});

		socket.on('event:user_status_change', function (data) {
			app.updateUserStatus($('.chats-list [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
		});

		messages.addSocketListeners();

		socket.on('event:chats.roomRename', function (data) {
			const roomEl = components.get('chat/recent/room', data.roomId);
			const titleEl = roomEl.find('[component="chat/title"]');
			ajaxify.data.roomName = data.newName;

			titleEl.text(data.newName);
		});

		socket.on('event:chats.mark', ({ roomId, state }) => {
			const roomEls = document.querySelectorAll(`[component="chat/recent"] [data-roomid="${roomId}"], [component="chat/list"] [data-roomid="${roomId}"]`);

			roomEls.forEach((roomEl) => {
				roomEl.classList[state ? 'add' : 'remove']('unread');

				const markEl = roomEl.querySelector('.mark-read');
				if (markEl) {
					markEl.querySelector('.read').classList[state ? 'add' : 'remove']('hidden');
					markEl.querySelector('.unread').classList[state ? 'remove' : 'add']('hidden');
				}
			});
		});
	};

	Chats.setActive = function () {
		if (ajaxify.data.roomId) {
			const chatEl = document.querySelector(`[component="chat/recent"] [data-roomid="${ajaxify.data.roomId}"]`);
			if (chatEl.classList.contains('unread')) {
				api.del(`/chats/${ajaxify.data.roomId}/state`, {});
				chatEl.classList.remove('unread');
			}

			if (!utils.isMobile()) {
				$('.expanded-chat [component="chat/input"]').focus();
			}
			messages.updateTextAreaHeight($(`[component="chat/messages"][data-roomid="${ajaxify.data.roomId}"]`));
		}
		$('.chats-list [data-roomid]').removeClass('active');
		$('.chats-list [data-roomid="' + ajaxify.data.roomId + '"]').addClass('active');

		components.get('chat/nav-wrapper').attr('data-loaded', ajaxify.data.roomId ? '1' : '0');
	};


	return Chats;
});
