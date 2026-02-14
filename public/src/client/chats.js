'use strict';


define('forum/chats', [
	'components',
	'mousetrap',
	'forum/chats/recent',
	'forum/chats/create',
	'forum/chats/manage',
	'forum/chats/messages',
	'forum/chats/user-list',
	'forum/chats/message-search',
	'forum/chats/pinned-messages',
	'autocomplete',
	'hooks',
	'bootbox',
	'alerts',
	'chat',
	'api',
	'uploadHelpers',
], function (
	components, mousetrap, recentChats, create,
	manage, messages, userList, messageSearch, pinnedMessages,
	autocomplete, hooks, bootbox, alerts, chatModule, api,
	uploadHelpers
) {
	const Chats = {
		initialised: false,
		activeAutocomplete: {},
	};

	let newMessage = false;
	let chatNavWrapper = null;

	$(window).on('action:ajaxify.start', function () {
		Chats.destroyAutoComplete(ajaxify.data.roomId);
		if (ajaxify.data.template.chats) {
			if (ajaxify.data.roomId) {
				socket.emit('modules.chats.leave', ajaxify.data.roomId);
			}
			if (ajaxify.data.publicRooms) {
				socket.emit('modules.chats.leavePublic', ajaxify.data.publicRooms.map(r => r.roomId));
			}
		}
	});

	Chats.init = function () {
		if (!utils.isMobile()) {
			$('.chats-full [data-bs-toggle="tooltip"]').tooltip({
				trigger: 'hover',
				container: '#content',
			});
		}
		socket.emit('modules.chats.enterPublic', ajaxify.data.publicRooms.map(r => r.roomId));
		const env = utils.findBootstrapEnvironment();
		chatNavWrapper = $('[component="chat/nav-wrapper"]');
		if (!Chats.initialised) {
			Chats.addSocketListeners();
			Chats.addGlobalEventListeners();
		}

		recentChats.init();

		Chats.addEventListeners();
		Chats.setActive(ajaxify.data.roomId);

		if (env === 'md' || env === 'lg' || env === 'xl' || env === 'xxl') {
			Chats.addHotkeys();
		}

		Chats.initialised = true;
		const chatContentEl = $('[component="chat/message/content"]');
		messages.wrapImagesInLinks(chatContentEl);
		if (ajaxify.data.scrollToIndex) {
			messages.toggleScrollUpAlert(chatContentEl);
			const scrollToEl = chatContentEl.find(`[data-index="${ajaxify.data.scrollToIndex - 1}"]`);
			if (scrollToEl.length) {
				chatContentEl.scrollTop(
					chatContentEl.scrollTop() - chatContentEl.offset().top + scrollToEl.offset().top
				);
			}
		} else {
			messages.scrollToBottomAfterImageLoad(chatContentEl);
		}
		create.init();

		hooks.fire('action:chat.loaded', $('.chats-full'));
	};

	Chats.addEventListeners = function () {
		const { roomId } = ajaxify.data;
		const mainWrapper = $('[component="chat/main-wrapper"]');
		const chatMessageContent = $('[component="chat/message/content"]');
		const chatControls = components.get('chat/controls');
		Chats.addSendHandlers(roomId, $('.chat-input'), $('.expanded-chat button[data-action="send"]'));
		Chats.addPopoutHandler();
		Chats.addActionHandlers(components.get('chat/message/window'), roomId);
		Chats.addManageHandler(roomId, chatControls.find('[data-action="manage"]'));
		Chats.addRenameHandler(roomId, chatControls.find('[data-action="rename"]'));
		Chats.addLeaveHandler(roomId, chatControls.find('[data-action="leave"]'));
		Chats.addDeleteHandler(roomId, chatControls.find('[data-action="delete"]'));
		Chats.addScrollHandler(roomId, ajaxify.data.uid, chatMessageContent);
		Chats.addScrollBottomHandler(roomId, chatMessageContent);
		Chats.addParentHandler(mainWrapper);
		Chats.addCharactersLeftHandler(mainWrapper);
		Chats.addTextareaResizeHandler(mainWrapper);
		Chats.addTypingHandler(mainWrapper, roomId);
		Chats.addIPHandler(mainWrapper);
		Chats.addCopyTextLinkHandler(mainWrapper);
		Chats.createAutoComplete(roomId, $('[component="chat/input"]'));
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
		userList.init(roomId, mainWrapper);
		Chats.addNotificationSettingHandler(roomId, mainWrapper);
		messageSearch.init(roomId, mainWrapper);
		Chats.addPublicRoomSortHandler();
		Chats.addTooltipHandler(mainWrapper);
		pinnedMessages.init(mainWrapper);
	};

	Chats.addPublicRoomSortHandler = function () {
		if (app.user.isAdmin && !utils.isMobile()) {
			app.loadJQueryUI(() => {
				const publicRoomList = $('[component="chat/public"]');
				publicRoomList.sortable({
					handle: '[component="chat/public/room/sort/handle"]',
					items: '[component="chat/public/room"]',
					axis: 'y',
					update: async function () {
						const data = { roomIds: [], scores: [] };
						publicRoomList.find('[data-roomid]').each((idx, el) => {
							data.roomIds.push($(el).attr('data-roomid'));
							data.scores.push(idx);
						});
						await api.put('/chats/sort', data);
					},
				});
			});
		}
	};

	Chats.addTooltipHandler = function (containerEl) {
		if (utils.isMobile()) {
			return;
		}

		containerEl.find('[data-manual-tooltip]').tooltip({
			trigger: 'manual',
			animation: false,
			placement: 'bottom',
		}).on('mouseenter', function (ev) {
			const target = $(ev.target);
			const isDropdown = target.hasClass('dropdown-menu') || !!target.parents('.dropdown-menu').length;
			if (!isDropdown) {
				$(this).tooltip('show');
			}
		}).on('click mouseleave', function () {
			$(this).tooltip('hide');
		});

		containerEl.tooltip({
			selector: '[component="chat/message/controls"] > .btn-group > button',
			placement: 'top',
			container: '#content',
			animation: false,
			trigger: 'hover',
		});
	};

	Chats.addNotificationSettingHandler = function (roomId, containerEl) {
		const notifSettingEl = containerEl.find('[component="chat/notification/setting"]');

		notifSettingEl.find('[data-value]').on('click', async function () {
			notifSettingEl.find('i.fa-check').addClass('hidden');
			const $this = $(this);
			$this.find('i.fa-check').removeClass('hidden');
			notifSettingEl.find('[component="chat/notification/setting/icon"]').attr('class', `fa ${$this.attr('data-icon')}`);
			await api.put(`/chats/${roomId}/watch`, {
				value: $this.attr('data-value'),
			});
		});
	};

	Chats.addParentHandler = function (mainWrapper) {
		mainWrapper.off('click', '[component="chat/message/parent"]')
			.on('click', '[component="chat/message/parent"]', function () {
				const parentEl = $(this);
				parentEl.find('[component="chat/message/parent/content"]').toggleClass('line-clamp-1');
				parentEl.find('.chat-timestamp').toggleClass('hidden');
				parentEl.toggleClass('flex-column').toggleClass('flex-row');
				const chatContent = parentEl.parents('[component="chat/message/content"]');
				if (chatContent.length && messages.isAtBottom(chatContent)) {
					messages.scrollToBottom(chatContent);
				}
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
		container.off('click', '.chat-ip-button')
			.on('click', '.chat-ip-button', async function (ev) {
				ev.stopPropagation();
				const ipEl = $(this);
				const ipCopyText = ipEl.find('.copy .copy-ip-text');
				let ip = ipEl.attr('data-ip');
				if (ip) {
					navigator.clipboard.writeText(ip);
					ipCopyText.translateText('[[global:copied]]');
					setTimeout(() => ipCopyText.text(ip), 2000);
					return;
				}
				const mid = ipEl.parents('[data-mid]').attr('data-mid');
				({ ip } = await api.get(`/chats/${ajaxify.data.roomId}/messages/${mid}/ip`));
				ipEl.attr('data-ip', ip);
				ipEl.find('.show').addClass('hidden');
				ipEl.find('.copy').removeClass('hidden');
				ipCopyText.text(ip);
			});
	};

	Chats.addCopyTextLinkHandler = function (container) {
		function doCopy(copyEl, text) {
			navigator.clipboard.writeText(text);
			copyEl.find('i').addClass('fa-check').removeClass('fa-link');
			setTimeout(() => copyEl.find('i').removeClass('fa-check').addClass('fa-link'), 2000);
		}

		container.off('click', '[data-action="copy-link"]')
			.on('click', '[data-action="copy-link"]', function (ev) {
				ev.stopPropagation();
				const copyEl = $(this);
				const mid = copyEl.attr('data-mid');
				if (mid) {
					doCopy(copyEl, `${window.location.origin}/message/${mid}`);
				}
			});

		container.off('click', '[data-action="copy-text"]')
			.on('click', '[data-action="copy-text"]', function (ev) {
				ev.stopPropagation();
				const copyEl = $(this);
				const messageEl = copyEl.parents('[data-mid]');
				if (messageEl.length) {
					doCopy(copyEl, messageEl.find('[component="chat/message/body"]').text().trim());
				}
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
		let previousScrollTop = el.scrollTop();
		let currentScrollTop = previousScrollTop;
		el.off('scroll').on('scroll', utils.debounce(function () {
			if (parseInt(el.attr('data-ignore-next-scroll'), 10) === 1) {
				el.removeAttr('data-ignore-next-scroll');
				previousScrollTop = el.scrollTop();
				return;
			}
			messages.toggleScrollUpAlert(el);
			if (loading) {
				return;
			}
			currentScrollTop = el.scrollTop();

			const direction = currentScrollTop > previousScrollTop ? 1 : -1;
			previousScrollTop = currentScrollTop;
			const scrollPercent = 100 * (currentScrollTop / (el[0].scrollHeight - el.height()));
			const top = 15;
			const bottom = 85;

			if (direction === 1 && !ajaxify.data.scrollToIndex) {
				// dont trigger infinitescroll if there is no /index in url
				return;
			}

			if ((scrollPercent < top && direction === -1) || (scrollPercent > bottom && direction === 1)) {
				loading = true;

				const msgEls = el.children('[data-mid]').not('.new');
				const afterEl = direction > 0 ? msgEls.last() : msgEls.first();
				const start = parseInt(afterEl.attr('data-index'), 10) || 0;

				api.get(`/chats/${roomId}/messages`, { uid, start, direction }).then((data) => {
					let messageData = data.messages;
					if (!messageData) {
						loading = false;
						return;
					}
					messageData = messageData.filter(function (chatMsg) {
						const msgOnDom = el.find('[component="chat/message"][data-mid="' + chatMsg.messageId + '"]');
						msgOnDom.removeClass('new');
						return !msgOnDom.length;
					});
					if (!messageData.length) {
						loading = false;
						return;
					}
					messages.parseMessage(messageData, function (html) {
						el.attr('data-ignore-next-scroll', 1);
						if (direction > 0) {
							html.insertAfter(afterEl);
							messages.onMessagesAddedToDom(html);
						} else {
							const currentScrollTop = el.scrollTop();
							const previousHeight = el[0].scrollHeight;
							el.prepend(html);
							messages.onMessagesAddedToDom(html);
							el.scrollTop((el[0].scrollHeight - previousHeight) + currentScrollTop);
						}

						loading = false;
					});
				}).catch(alerts.error);
			}
		}, 100));
	};

	Chats.addScrollBottomHandler = function (roomId, chatContent) {
		chatContent.parents('[component="chat/message/window"]')
			.find('[component="chat/messages/scroll-up-alert"]')
			.off('click').on('click', function () {
				if (ajaxify.data.scrollToIndex && parseInt(ajaxify.data.roomId, 10) === parseInt(roomId, 10)) {
					Chats.switchChat(roomId);
				} else {
					messages.scrollToBottom(chatContent);
				}
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
			const chatContentEl = parent.find('[component="chat/message/content"]');
			const isAtBottom = messages.isAtBottom(chatContentEl);
			textarea.css({ height: 0 });
			textarea.css({ height: messages.calcAutoTextAreaHeight(textarea) + 'px' });
			if (isAtBottom) {
				messages.scrollToBottom(chatContentEl);
			}
		});
	};

	Chats.addTypingHandler = function (parent, roomId) {
		const textarea = parent.find('[component="chat/input"]');
		function emitTyping(typing) {
			api.put(`/chats/${roomId}/typing`, { typing }).catch(alerts.error);
		}

		textarea.on('focus', () => textarea.val() && emitTyping(true));
		textarea.on('blur', () => emitTyping(false));
		let timeoutid = 0;
		let hasText = !!textarea.val();
		textarea.on('input', function () {
			const _hasText = !!textarea.val();
			if (_hasText !== hasText) {
				clearTimeout(timeoutid);
				timeoutid = 0;
				hasText = _hasText;
				emitTyping(hasText);
			} else if (!timeoutid) {
				timeoutid = setTimeout(() => {
					emitTyping(!!textarea.val());
					timeoutid = 0;
				}, 5000);
			}
		});
	};

	Chats.addActionHandlers = function (element, roomId) {
		element.on('click', '[data-mid] [data-action]', function () {
			const msgEl = $(this).parents('[data-mid]');
			const messageId = msgEl.attr('data-mid');
			const action = this.getAttribute('data-action');
			$(this).tooltip('dispose');
			switch (action) {
				case 'reply':
					messages.prepReplyTo(msgEl, element);
					break;
				case 'edit':
					messages.prepEdit(msgEl, messageId, roomId);
					break;
				case 'delete':
					messages.delete(messageId, roomId);
					break;
				case 'restore':
					messages.restore(messageId, roomId);
					break;
				case 'pin':
					pinnedMessages.pin(messageId, roomId);
					break;
				case 'unpin':
					pinnedMessages.unpin(messageId, roomId);
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
				messages.prepEdit(message, lastMid, ajaxify.data.roomId);
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

	Chats.addRenameHandler = function (roomId, buttonEl) {
		buttonEl.on('click', async function () {
			const { roomName } = await api.get(`/chats/${roomId}`);
			const html = await app.parseAndTranslate('modals/rename-room', {
				name: roomName,
			});
			const modal = bootbox.dialog({
				title: '[[modules:chat.rename-room]]',
				message: html,
				onEscape: true,
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: function () {
							api.put(`/chats/${roomId}`, {
								name: modal.find('#roomName').val(),
							}).then(() => {
								modal.modal('hide');
							}).catch(alerts.error);
							return false;
						},
					},
				},
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

	Chats.switchChat = function (roomId) {
		// Allow empty arg for return to chat list/close chat
		if (!roomId) {
			roomId = '';
		}
		Chats.destroyAutoComplete(ajaxify.data.roomId);
		socket.emit('modules.chats.leave', ajaxify.data.roomId);
		const url = 'user/' + ajaxify.data.userslug + '/chats/' + roomId + window.location.search;
		if (!self.fetch) {
			return ajaxify.go(url);
		}
		const params = new URL(document.location).searchParams;
		params.set('switch', 1);
		const dataUrl = `${config.relative_path}/api/user/${ajaxify.data.userslug}/chats/${roomId}?${params.toString()}`;
		fetch(dataUrl, { credentials: 'include' })
			.then(async function (response) {
				if (!response.ok) {
					return console.warn('[search] Received ' + response.status);
				}
				const payload = await response.json();
				const html = await app.parseAndTranslate('partials/chats/message-window', payload);
				const mainWrapper = components.get('chat/main-wrapper');
				mainWrapper.html(html);
				mainWrapper.attr('data-roomid', roomId);
				chatNavWrapper = $('[component="chat/nav-wrapper"]');
				html.find('.timeago').timeago();
				ajaxify.data = { ...ajaxify.data, ...payload, roomId: roomId };
				ajaxify.updateTitle(ajaxify.data.title);
				$('body').toggleClass('chat-loaded', !!roomId);
				mainWrapper.find('[data-bs-toggle="tooltip"]').tooltip({ trigger: 'hover', container: '#content' });
				Chats.setActive(roomId);
				Chats.addEventListeners();
				hooks.fire('action:chat.loaded', $('.chats-full'));
				messages.scrollToBottomAfterImageLoad(mainWrapper.find('[component="chat/message/content"]'));
				if (history.pushState) {
					history.pushState({
						url: url,
					}, null, window.location.protocol + '//' + window.location.host + config.relative_path + '/' + url);
				}
			})
			.catch(function (error) {
				console.warn('[search] ' + error.message);
			});
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
				messages.appendChatMessage($('[component="chat/message/content"]'), data.message);

				Chats.updateTeaser(data.roomId, {
					content: utils.stripHTMLTags(utils.decodeHTMLEntities(data.message.content)),
					user: data.message.fromUser,
					timestampISO: data.message.timestampISO,
				});
			}
		});

		socket.on('event:chats.public.unread', function (data) {
			if (
				chatModule.isFromBlockedUser(data.fromUid) ||
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
				titleEl.translateText(data.newName ? data.newName : ajaxify.data.usernames);
			}
			const titleEl = $(`[component="chat/main-wrapper"][data-roomid="${data.roomId}"] [component="chat/header/title"]`);
			if (titleEl.length) {
				titleEl.html(
					data.newName ?
						`<i class="fa ${ajaxify.data.icon} text-muted"></i> ${data.newName}` :
						ajaxify.data.chatWithMessage
				);
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

		socket.on('event:chats.typing', async (data) => {
			if (data.uid === app.user.uid || chatModule.isFromBlockedUser(data.uid)) {
				return;
			}
			chatModule.updateTypingUserList($(`[component="chat/main-wrapper"][data-roomid="${data.roomId}"]`), data);
		});
	};

	Chats.updateTeaser = async function (roomId, teaser) {
		if (!ajaxify.data.template.chats || !app.user.userslug) {
			return;
		}
		const roomEl = chatNavWrapper.find(`[data-roomid="${roomId}"]`);
		if (roomEl.length) {
			const html = await app.parseAndTranslate('partials/chats/room-teaser', {
				teaser: teaser,
			});
			roomEl.find('[component="chat/room/teaser"]').html(html[0].outerHTML);
			roomEl.find('.timeago').timeago();
		} else {
			const { rooms } = await api.get(`/chats`, { start: 0, perPage: 2 });
			const room = rooms.find(r => parseInt(r.roomId, 10) === parseInt(roomId, 10));
			if (room) {
				const recentEl = components.get('chat/recent');
				const html = await app.parseAndTranslate('chats', 'rooms', {
					rooms: [room],
					showBottomHr: true,
				});
				recentEl.prepend(html);
			}
		}
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

	Chats.setActive = function (roomId) {
		chatNavWrapper.find('[data-roomid]').removeClass('active');
		if (roomId) {
			socket.emit('modules.chats.enter', roomId);
			const chatEl = chatNavWrapper.find(`[data-roomid="${roomId}"]`);
			chatEl.addClass('active');
			if (chatEl.hasClass('unread')) {
				api.del(`/chats/${roomId}/state`, {});
				chatEl.removeClass('unread');
			}

			if (!utils.isMobile()) {
				$('.expanded-chat [component="chat/input"]').focus();
			}
			messages.updateTextAreaHeight($(`[component="chat/messages"][data-roomid="${roomId}"]`));
		}

		chatNavWrapper.attr('data-loaded', roomId ? '1' : '0');
	};

	return Chats;
});

