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
	'chat',
], function (
	components, translator, mousetrap,
	recentChats, search, messages,
	autocomplete, hooks, bootbox, chatModule
) {
	const Chats = {
		initialised: false,
	};

	let newMessage = false;

	Chats.init = function () {
		const env = utils.findBootstrapEnvironment();

		if (!Chats.initialised) {
			Chats.addSocketListeners();
			Chats.addGlobalEventListeners();
		}

		recentChats.init();

		Chats.addEventListeners();
		Chats.resizeMainWindow();
		Chats.setActive();

		if (env === 'md' || env === 'lg') {
			Chats.addHotkeys();
		}

		$(document).ready(function () {
			hooks.fire('action:chat.loaded', $('.chats-full'));
		});

		Chats.initialised = true;
		messages.scrollToBottom($('.expanded-chat ul.chat-content'));

		search.init();

		if (ajaxify.data.hasOwnProperty('roomId')) {
			components.get('chat/input').focus();
		}
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
		Chats.addIPHandler($('[component="chat/main-wrapper"]'));
		Chats.createAutoComplete($('[component="chat/input"]'));

		$('[data-action="close"]').on('click', function () {
			Chats.switchChat();
		});
	};

	Chats.addIPHandler = function (container) {
		container.on('click', '.chat-ip-button', function () {
			const ipEl = $(this).parent();
			const mid = ipEl.parents('[data-mid]').attr('data-mid');
			socket.emit('modules.chats.getIP', mid, function (err, ip) {
				if (err) {
					return app.alertError(err);
				}
				ipEl.html(ip);
			});
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
			socket.emit('modules.chats.getMessages', {
				roomId: roomId,
				uid: uid,
				start: start,
			}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}
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
					html = $(html);
					el.prepend(html);
					html.find('.timeago').timeago();
					html.find('img:not(.not-responsive)').addClass('img-responsive');
					el.scrollTop((el[0].scrollHeight - previousHeight) + currentScrollTop);
					loading = false;
				});
			});
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
			if (e.target === components.get('chat/input').get(0)) {
				// Retrieve message id from messages list
				const message = components.get('chat/messages').find('.chat-message[data-self="1"]').last();
				if (!message.length) {
					return;
				}
				const lastMid = message.attr('data-mid');
				const inputEl = components.get('chat/input');

				messages.prepEdit(inputEl, lastMid, ajaxify.data.roomId);
			}
		});
	};

	Chats.addMemberHandler = function (roomId, buttonEl) {
		let modal;

		buttonEl.on('click', function () {
			app.parseAndTranslate('partials/modals/manage_room', {}, function (html) {
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
						socket.emit('modules.chats.addUserToRoom', {
							roomId: roomId,
							username: selected.item.user.name,
						}, function (err) {
							if (err) {
								translator.translate(err.message, function (translated) {
									errorEl.text(translated);
								});
							}

							Chats.refreshParticipantsList(roomId, modal);
							searchInput.val('');
						});
					});
				});
			});
		});
	};

	Chats.addKickHandler = function (roomId, modal) {
		modal.on('click', '[data-action="kick"]', function () {
			const uid = parseInt(this.getAttribute('data-uid'), 10);

			socket.emit('modules.chats.removeUserFromRoom', {
				roomId: roomId,
				uid: uid,
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				Chats.refreshParticipantsList(roomId, modal);
			});
		});
	};

	Chats.addLeaveHandler = function (roomId, buttonEl) {
		buttonEl.on('click', function () {
			bootbox.confirm({
				size: 'small',
				title: '[[modules:chat.leave]]',
				message: '<p>[[modules:chat.leave-prompt]]</p><p class="help-block">[[modules:chat.leave-help]]</p>',
				callback: function (ok) {
					if (ok) {
						socket.emit('modules.chats.leave', roomId, function (err) {
							if (err) {
								app.alertError(err.message);
							}

							// Return user to chats page. If modal, close modal.
							const modal = buttonEl.parents('.chat-modal');
							if (modal.length) {
								chatModule.close(modal);
							} else {
								ajaxify.go('chats');
							}
						});
					}
				},
			});
		});
	};

	Chats.refreshParticipantsList = function (roomId, modal) {
		socket.emit('modules.chats.getUsersInRoom', { roomId: roomId }, function (err, users) {
			const listEl = modal.find('.list-group');

			if (err) {
				return translator.translate('[[error:invalid-data]]', function (translated) {
					listEl.find('li').text(translated);
				});
			}

			app.parseAndTranslate('partials/modals/manage_room_users', {
				users: users,
			}, function (html) {
				listEl.html(html);
			});
		});
	};

	Chats.addRenameHandler = function (roomId, buttonEl, roomName) {
		let modal;

		buttonEl.on('click', function () {
			app.parseAndTranslate('partials/modals/rename_room', {
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
			socket.emit('modules.chats.renameRoom', {
				roomId: roomId,
				newName: modal.find('#roomName').val(),
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
			});
		}
	};

	Chats.addSendHandlers = function (roomId, inputEl, sendEl) {
		inputEl.off('keypress').on('keypress', function (e) {
			if (e.which === 13 && !e.shiftKey) {
				messages.sendMessage(roomId, inputEl);
				return false;
			}
		});

		sendEl.off('click').on('click', function () {
			messages.sendMessage(roomId, inputEl);
			inputEl.focus();
			return false;
		});
	};

	Chats.createAutoComplete = function (element) {
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
			},
		};

		hooks.fire('chat:autocomplete:init', data);
		if (data.strategies.length) {
			autocomplete.setup(data);
		}
	};

	Chats.leave = function (el) {
		const roomId = el.attr('data-roomid');
		socket.emit('modules.chats.leave', roomId, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			if (parseInt(roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				ajaxify.go('user/' + ajaxify.data.userslug + '/chats');
			} else {
				el.remove();
			}

			const modal = chatModule.getModal(roomId);
			if (modal.length) {
				chatModule.close(modal);
			}
		});
	};

	Chats.switchChat = function (roomid) {
		// Allow empty arg for return to chat list/close chat
		if (!roomid) {
			roomid = '';
		}

		const url = 'user/' + ajaxify.data.userslug + '/chats/' + roomid + window.location.search;
		if (self.fetch) {
			fetch(config.relative_path + '/api/' + url, { credentials: 'include' })
				.then(function (response) {
					if (response.ok) {
						response.json().then(function (payload) {
							app.parseAndTranslate('partials/chats/message-window', payload, function (html) {
								components.get('chat/main-wrapper').html(html);
								html.find('.timeago').timeago();
								Chats.resizeMainWindow();
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
		$(window).on('resize', utils.throttle(Chats.resizeMainWindow, 100));
		$(window).on('mousemove keypress click', function () {
			if (newMessage && ajaxify.data.roomId) {
				socket.emit('modules.chats.markRead', ajaxify.data.roomId);
				newMessage = false;
			}
		});
	};

	Chats.addSocketListeners = function () {
		socket.on('event:chats.receive', function (data) {
			if (parseInt(data.roomId, 10) === parseInt(ajaxify.data.roomId, 10)) {
				newMessage = data.self === 0;
				data.message.self = data.self;

				messages.appendChatMessage($('.expanded-chat .chat-content'), data.message);
			} else if (ajaxify.data.template.chats) {
				const roomEl = $('[data-roomid=' + data.roomId + ']');

				if (roomEl.length > 0) {
					roomEl.addClass('unread');
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
	};

	Chats.resizeMainWindow = function () {
		const viewportHeight = $(window).height();
		const mainWrapper = components.get('chat/main-wrapper');
		const navWrapper = components.get('chat/nav-wrapper');
		let fromTop = 0;
		if (mainWrapper.length && navWrapper.length) {
			fromTop = mainWrapper.offset().top || navWrapper.offset().top;
		}

		$('.chats-full').height(viewportHeight - fromTop - 1);
	};

	Chats.setActive = function () {
		if (ajaxify.data.roomId) {
			socket.emit('modules.chats.markRead', ajaxify.data.roomId);
			$('[data-roomid="' + ajaxify.data.roomId + '"]').toggleClass('unread', false);
			$('.expanded-chat [component="chat/input"]').focus();
		}
		$('.chats-list li').removeClass('bg-info');
		$('.chats-list li[data-roomid="' + ajaxify.data.roomId + '"]').addClass('bg-info');

		components.get('chat/nav-wrapper').attr('data-loaded', ajaxify.data.roomId ? '1' : '0');
	};


	return Chats;
});
