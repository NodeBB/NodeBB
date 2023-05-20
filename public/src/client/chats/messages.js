'use strict';


define('forum/chats/messages', [
	'components', 'hooks', 'bootbox', 'alerts',
	'messages', 'api', 'forum/topic/images',
], function (
	components, hooks, bootbox, alerts, messagesModule, api, images
) {
	const messages = {};

	messages.sendMessage = async function (roomId, inputEl) {
		let message = inputEl.val();
		if (!message.trim().length) {
			return;
		}
		const chatContent = inputEl.parents(`[component="chat/messages"][data-roomid="${roomId}"]`);
		inputEl.val('').trigger('input');

		messages.updateRemainingLength(inputEl.parent());
		messages.updateTextAreaHeight(chatContent);
		const payload = { roomId, message };
		({ roomId, message } = await hooks.fire('filter:chat.send', payload));

		api.post(`/chats/${roomId}`, { message }).then(() => {
			hooks.fire('action:chat.sent', { roomId, message });
		}).catch((err) => {
			inputEl.val(message).trigger('input');
			messages.updateRemainingLength(inputEl.parent());
			messages.updateTextAreaHeight(chatContent);
			if (err.message === '[[error:email-not-confirmed-chat]]') {
				return messagesModule.showEmailConfirmWarning(err.message);
			}

			alerts.alert({
				alert_id: 'chat_spam_error',
				title: '[[global:alert.error]]',
				message: err.message,
				type: 'danger',
				timeout: 10000,
			});
		});
	};

	messages.updateRemainingLength = function (parent) {
		const element = parent.find('[component="chat/input"]');
		parent.find('[component="chat/message/length"]').text(element.val().length);
		parent.find('[component="chat/message/remaining"]').text(config.maximumChatMessageLength - element.val().length);
		hooks.fire('action:chat.updateRemainingLength', {
			parent: parent,
		});
	};

	messages.updateTextAreaHeight = function (chatContentEl) {
		const textarea = chatContentEl.find('[component="chat/input"]');
		textarea.css({ height: messages.calcAutoTextAreaHeight(textarea) + 'px' });
	};

	messages.calcAutoTextAreaHeight = function (textarea) {
		const scrollHeight = textarea.prop('scrollHeight');
		const borderTopWidth = parseFloat(textarea.css('border-top-width'), 10) || 0;
		const borderBottomWidth = parseFloat(textarea.css('border-bottom-width'), 10) || 0;
		return scrollHeight + borderTopWidth + borderBottomWidth;
	};

	function autoresizeTextArea(textarea) {
		textarea.css({ height: messages.calcAutoTextAreaHeight(textarea) + 'px' });
		textarea.on('input', function () {
			textarea.css({ height: 0 });
			textarea.css({ height: messages.calcAutoTextAreaHeight(textarea) + 'px' });
		});
	}

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
		messages.onMessagesAddedToDom(newMessage);
		if (isAtBottom) {
			messages.scrollToBottom(chatContentEl);
		}

		hooks.fire('action:chat.received', {
			messageEl: newMessage,
		});
	}

	messages.onMessagesAddedToDom = function (messageEls) {
		messageEls.find('.timeago').timeago();
		messageEls.find('img:not(.not-responsive)').addClass('img-fluid');
		messages.wrapImagesInLinks(messageEls.first().parent());
	};

	messages.parseMessage = function (data, callback) {
		const tplData = {
			messages: data,
			isAdminOrGlobalMod: app.user.isAdmin || app.user.isGlobalMod,

		};
		if (Array.isArray(data)) {
			app.parseAndTranslate('partials/chats/messages', tplData).then(callback);
		} else {
			app.parseAndTranslate('partials/chats/' + (data.system ? 'system-message' : 'message'), tplData).then(callback);
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

	messages.wrapImagesInLinks = function (containerEl) {
		containerEl.find('[component="chat/message/body"] img:not(.emoji)').each(function () {
			images.wrapImageInLink($(this));
		});
	};

	messages.toggleScrollUpAlert = function (containerEl) {
		const isAtBottom = messages.isAtBottom(containerEl, 300);
		containerEl.parent()
			.find('[component="chat/messages/scroll-up-alert"]')
			.toggleClass('hidden', isAtBottom);
	};

	messages.prepEdit = async function (inputEl, mid, roomId) {
		const raw = await socket.emit('modules.chats.getRaw', { mid: mid, roomId: roomId });
		const editEl = await app.parseAndTranslate('partials/chats/edit-message', {
			rawContent: raw,
		});
		const messageBody = $(`[data-roomid="${roomId}"] [data-mid="${mid}"] [component="chat/message/body"]`);
		const messageControls = $(`[data-roomid="${roomId}"] [data-mid="${mid}"] [component="chat/message/controls"]`);
		const chatContent = messageBody.parents('.chat-content');

		messageBody.addClass('hidden');
		messageControls.addClass('hidden');
		editEl.insertAfter(messageBody);

		const textarea = editEl.find('textarea');

		textarea.focus().putCursorAtEnd();
		autoresizeTextArea(textarea);

		if (messages.isAtBottom(chatContent)) {
			messages.scrollToBottom(chatContent);
		}

		const chats = await app.require('forum/chats');
		const autoCompleteEl = chats.createAutoComplete(0, textarea, {
			placement: 'bottom',
		});

		function finishEdit() {
			messageBody.removeClass('hidden');
			messageControls.removeClass('hidden');
			editEl.remove();
			if (autoCompleteEl) {
				autoCompleteEl.destroy();
			}
		}
		textarea.on('keyup', (e) => {
			if (e.key === 'Escape') {
				finishEdit();
			}
		});
		editEl.find('[data-action="cancel"]').on('click', finishEdit);

		editEl.find('[data-action="save"]').on('click', function () {
			const message = textarea.val();
			if (!message.trim().length) {
				return;
			}
			api.put(`/chats/${roomId}/messages/${mid}`, { message }).then(() => {
				finishEdit();
				hooks.fire('action:chat.edited', { roomId, message, mid });
			}).catch((err) => {
				textarea.val(message).trigger('input');
				alerts.error(err);
			});
		});

		hooks.fire('action:chat.prepEdit', {
			inputEl: inputEl,
			messageId: mid,
			roomId: roomId,
			editEl: editEl,
			messageBody: messageBody,
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
					messages.onMessagesAddedToDom(html);
				}
			});
		});
	}

	function onChatMessageDeleted(messageId) {
		components.get('chat/message', messageId)
			.toggleClass('deleted', true)
			.find('[component="chat/message/body"]')
			.translateHtml('[[modules:chat.message-deleted]]');
	}

	function onChatMessageRestored(message) {
		components.get('chat/message', message.messageId)
			.toggleClass('deleted', false)
			.find('[component="chat/message/body"]')
			.html(message.content);
	}

	messages.delete = function (messageId, roomId) {
		bootbox.confirm('[[modules:chat.delete_message_confirm]]', function (ok) {
			if (!ok) {
				return;
			}

			api.del(`/chats/${roomId}/messages/${messageId}`, {}).then(() => {
				components.get('chat/message', messageId).toggleClass('deleted', true);
			}).catch(alerts.error);
		});
	};

	messages.restore = function (messageId, roomId) {
		api.post(`/chats/${roomId}/messages/${messageId}`, {}).then(() => {
			components.get('chat/message', messageId).toggleClass('deleted', false);
		}).catch(alerts.error);
	};

	return messages;
});
