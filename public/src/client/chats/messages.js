'use strict';

/* globals define, socket, app, ajaxify, templates, bootbox */

define('forum/chats/messages', ['components', 'sounds', 'translator'], function(components, sounds, translator) {

	var messages = {};

	messages.sendMessage = function(roomId, inputEl) {
		var msg = inputEl.val();
		var mid = inputEl.attr('data-mid');

		if (msg.length > ajaxify.data.maximumChatMessageLength) {
			return app.alertError('[[error:chat-message-too-long]]');
		}

		if (!msg.length) {
			return;
		}

		inputEl.val('');
		inputEl.removeAttr('data-mid');

		if (!mid) {
			socket.emit('modules.chats.send', {
				roomId: roomId,
				message: msg
			}, function(err) {
				if (err) {
					if (err.message === '[[error:email-not-confirmed-chat]]') {
						return app.showEmailConfirmWarning(err);
					}
					return app.alertError(err.message);
				}

				sounds.play('chat-outgoing');
			});
		} else {
			socket.emit('modules.chats.edit', {
				roomId: roomId,
				mid: mid,
				message: msg
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
			});
		}
	};

	messages.appendChatMessage = function(chatContentEl, data) {

		var lastSpeaker = parseInt(chatContentEl.find('.chat-message').last().attr('data-uid'), 10);
		if (!Array.isArray(data)) {
			data.newSet = lastSpeaker !== data.fromuid;
		}

		messages.parseMessage(data, function(html) {
			onMessagesParsed(chatContentEl, html);
		});
	};

	function onMessagesParsed(chatContentEl, html) {
		var newMessage = $(html);

		newMessage.appendTo(chatContentEl);
		newMessage.find('.timeago').timeago();
		newMessage.find('img:not(.not-responsive)').addClass('img-responsive');
		messages.scrollToBottom(chatContentEl);
	}


	messages.parseMessage = function(data, callback) {
		templates.parse('partials/chat_message' + (Array.isArray(data) ? 's' : ''), {
			messages: data
		}, function(html) {
			translator.translate(html, callback);
		});
	};


	messages.scrollToBottom = function(containerEl) {
		if (containerEl.length) {
			containerEl.scrollTop(
				containerEl[0].scrollHeight - containerEl.height()
			);
		}
	};

	messages.prepEdit = function(inputEl, messageId, roomId) {
		socket.emit('modules.chats.getRaw', { mid: messageId, roomId: roomId }, function(err, raw) {
			if (err) {
				return app.alertError(err.message);
			}
			// Populate the input field with the raw message content
			if (inputEl.val().length === 0) {
				// By setting the `data-mid` attribute, I tell the chat code that I am editing a
				// message, instead of posting a new one.
				inputEl.attr('data-mid', messageId).addClass('editing');
				inputEl.val(raw);
			}
		});
	};

	messages.onChatMessageEdit = function() {
		socket.on('event:chats.edit', function(data) {
			data.messages.forEach(function(message) {
				var self = parseInt(message.fromuid, 10) === parseInt(app.user.uid);
				message.self = self ? 1 : 0;
				messages.parseMessage(message, function(html) {
				    var body = components.get('chat/message', message.messageId);
					if (body.length) {
						body.replaceWith(html);
						components.get('chat/message', message.messageId).find('.timeago').timeago();
					}
				});
			});
		});
	};

	messages.delete = function(messageId, roomId) {
		translator.translate('[[modules:chat.delete_message_confirm]]', function(translated) {
			bootbox.confirm(translated, function(ok) {
				if (!ok) {
					return;
				}

				socket.emit('modules.chats.delete', {
					messageId: messageId,
					roomId: roomId
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					components.get('chat/message', messageId).slideUp('slow', function() {
						$(this).remove();
					});
				});
			});
		});
	};

	return messages;
});