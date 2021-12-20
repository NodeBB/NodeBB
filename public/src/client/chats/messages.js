'use strict';


define('forum/chats/messages', [
	'components', 'translator', 'benchpress', 'hooks',
	'bootbox', 'alerts', 'messages', 'api',
], function (components, translator, Benchpress, hooks, bootbox, alerts, messagesModule, api) {
	const messages = {};

	messages.sendMessage = function (roomId, inputEl) {
		const message = inputEl.val();
		const mid = inputEl.attr('data-mid');

		if (!message.trim().length) {
			return;
		}

		inputEl.val('');
		inputEl.removeAttr('data-mid');
		messages.updateRemainingLength(inputEl.parent());
		hooks.fire('action:chat.sent', { roomId, message, mid });

		if (!mid) {
			api.post(`/chats/${roomId}`, { message }).catch((err) => {
				inputEl.val(message);
				messages.updateRemainingLength(inputEl.parent());
				if (err.message === '[[error:email-not-confirmed-chat]]') {
					return messagesModule.showEmailConfirmWarning(err.message);
				}

				return alerts.alert({
					alert_id: 'chat_spam_error',
					title: '[[global:alert.error]]',
					message: err.message,
					type: 'danger',
					timeout: 10000,
				});
			});
		} else {
			api.put(`/chats/${roomId}/${mid}`, { message }).catch((err) => {
				inputEl.val(message);
				inputEl.attr('data-mid', mid);
				messages.updateRemainingLength(inputEl.parent());
				return alerts.error(err);
			});
		}
	};

	messages.updateRemainingLength = function (parent) {
		const element = parent.find('[component="chat/input"]');
		parent.find('[component="chat/message/length"]').text(element.val().length);
		parent.find('[component="chat/message/remaining"]').text(config.maximumChatMessageLength - element.val().length);
		hooks.fire('action:chat.updateRemainingLength', {
			parent: parent,
		});
	};

	messages.appendChatMessage = function (chatContentEl, data) {
		const lastSpeaker = parseInt(chatContentEl.find('.chat-message').last().attr('data-uid'), 10);
		const lasttimestamp = parseInt(chatContentEl.find('.chat-message').last().attr('data-timestamp'), 10);
		if (!Array.isArray(data)) {
			data.newSet = lastSpeaker !== parseInt(data.fromuid, 10) ||
				parseInt(data.timestamp, 10) > parseInt(lasttimestamp, 10) + (1000 * 60 * 3);
		}

		messages.parseMessage(data, function (html) {
			onMessagesParsed(chatContentEl, html);
		});
	};

	function onMessagesParsed(chatContentEl, html) {
		const newMessage = $(html);
		const isAtBottom = messages.isAtBottom(chatContentEl);
		newMessage.appendTo(chatContentEl);
		newMessage.find('.timeago').timeago();
		newMessage.find('img:not(.not-responsive)').addClass('img-responsive');
		if (isAtBottom) {
			messages.scrollToBottom(chatContentEl);
		}

		hooks.fire('action:chat.received', {
			messageEl: newMessage,
		});
	}


	messages.parseMessage = function (data, callback) {
		function done(html) {
			translator.translate(html, callback);
		}

		if (Array.isArray(data)) {
			Benchpress.render('partials/chats/message' + (Array.isArray(data) ? 's' : ''), {
				messages: data,
			}).then(done);
		} else {
			Benchpress.render('partials/chats/' + (data.system ? 'system-message' : 'message'), {
				messages: data,
			}).then(done);
		}
	};

	messages.isAtBottom = function (containerEl, threshold) {
		if (containerEl.length) {
			const distanceToBottom = containerEl[0].scrollHeight - (
				containerEl.outerHeight() + containerEl.scrollTop()
			);
			return distanceToBottom < (threshold || 100);
		}
	};

	messages.scrollToBottom = function (containerEl) {
		if (containerEl && containerEl.length) {
			containerEl.scrollTop(containerEl[0].scrollHeight - containerEl.height());
			containerEl.parent()
				.find('[component="chat/messages/scroll-up-alert"]')
				.addClass('hidden');
		}
	};

	messages.toggleScrollUpAlert = function (containerEl) {
		const isAtBottom = messages.isAtBottom(containerEl, 300);
		containerEl.parent()
			.find('[component="chat/messages/scroll-up-alert"]')
			.toggleClass('hidden', isAtBottom);
	};

	messages.prepEdit = function (inputEl, messageId, roomId) {
		socket.emit('modules.chats.getRaw', { mid: messageId, roomId: roomId }, function (err, raw) {
			if (err) {
				return alerts.error(err);
			}
			// Populate the input field with the raw message content
			if (inputEl.val().length === 0) {
				// By setting the `data-mid` attribute, I tell the chat code that I am editing a
				// message, instead of posting a new one.
				inputEl.attr('data-mid', messageId).addClass('editing');
				inputEl.val(raw).focus();

				hooks.fire('action:chat.prepEdit', {
					inputEl: inputEl,
					messageId: messageId,
					roomId: roomId,
				});
			}
		});
	};

	messages.addSocketListeners = function () {
		socket.removeListener('event:chats.edit', onChatMessageEdited);
		socket.on('event:chats.edit', onChatMessageEdited);

		socket.removeListener('event:chats.delete', onChatMessageDeleted);
		socket.on('event:chats.delete', onChatMessageDeleted);

		socket.removeListener('event:chats.restore', onChatMessageRestored);
		socket.on('event:chats.restore', onChatMessageRestored);
	};

	function onChatMessageEdited(data) {
		data.messages.forEach(function (message) {
			const self = parseInt(message.fromuid, 10) === parseInt(app.user.uid, 10);
			message.self = self ? 1 : 0;
			messages.parseMessage(message, function (html) {
				const body = components.get('chat/message', message.messageId);
				if (body.length) {
					body.replaceWith(html);
					components.get('chat/message', message.messageId).find('.timeago').timeago();
				}
			});
		});
	}

	function onChatMessageDeleted(messageId) {
		components.get('chat/message', messageId)
			.toggleClass('deleted', true)
			.find('[component="chat/message/body"]').translateHtml('[[modules:chat.message-deleted]]');
	}

	function onChatMessageRestored(message) {
		components.get('chat/message', message.messageId)
			.toggleClass('deleted', false)
			.find('[component="chat/message/body"]').html(message.content);
	}

	messages.delete = function (messageId, roomId) {
		translator.translate('[[modules:chat.delete_message_confirm]]', function (translated) {
			bootbox.confirm(translated, function (ok) {
				if (!ok) {
					return;
				}

				api.delete(`/chats/${roomId}/${messageId}`, {}).then(() => {
					components.get('chat/message', messageId).toggleClass('deleted', true);
				}).catch(alerts.error);
			});
		});
	};

	messages.restore = function (messageId, roomId) {
		api.post(`/chats/${roomId}/${messageId}`, {}).then(() => {
			components.get('chat/message', messageId).toggleClass('deleted', false);
		}).catch(alerts.error);
	};

	return messages;
});
