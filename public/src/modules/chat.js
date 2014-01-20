define(['taskbar', 'string'], function(taskbar, S) {

	var module = {};

	module.prepareDOM = function() {
		// Chats Dropdown
		var	chatsToggleEl = $('#chat_dropdown'),
			chatsListEl = $('#chat-list'),
			chatDropdownEl = chatsToggleEl.parent();

		chatsToggleEl.on('click', function() {
			if (chatDropdownEl.hasClass('open')) {
				return;
			}

			socket.emit('modules.chats.list', function(err, chats) {
				var	chatsFrag = document.createDocumentFragment(),
					chatEl = document.createElement('li'),
					numChats = chats.length,
					x, userObj;

				if (!err && numChats > 0) {
					for(x=0;x<numChats;x++) {
						userObj = chats[x];
						chatEl.setAttribute('data-uid', userObj.uid);
						chatEl.innerHTML = '<a href="javascript:app.openChat(\'' + userObj.username + '\', ' + userObj.uid + ');"><img src="' + userObj.picture + '" title="' + userObj.username + '" />' + userObj.username + '</a>';

						chatsFrag.appendChild(chatEl.cloneNode(true));
					}

					chatsListEl.empty();
					chatsListEl.html(chatsFrag);
				} else {
					translator.get('modules:chat.no_active', function(str) {
						chatEl.className = 'no_active';
						chatEl.innerHTML = '<a href="#">' + str + '</a>';
						chatsFrag.appendChild(chatEl.cloneNode(true));

						chatsListEl.empty();
						chatsListEl.html(chatsFrag);
					});
				}
			});
		});

		socket.on('event:chats.receive', function(data) {

			if (module.modalExists(data.fromuid)) {
				var modal = module.getModal(data.fromuid);
				module.appendChatMessage(modal, data.message, data.timestamp);

				if (modal.is(":visible")) {
					module.bringModalToTop(modal);
					checkOnlineStatus(modal);
					taskbar.updateActive(modal.attr('UUID'));
					scrollToBottom(modal.find('#chat-content'));
				} else {
					module.toggleNew(modal.attr('UUID'), true);
				}

				if (!modal.is(":visible") || !app.isFocused) {
					app.alternatingTitle(data.username + ' has messaged you');
				}
			} else {
				module.createModal(data.username, data.fromuid, function(modal) {
					module.toggleNew(modal.attr('UUID'), true);
					app.alternatingTitle(data.username + ' has messaged you');
				});
			}
		});
	}

	module.bringModalToTop = function(chatModal) {
		var topZ = 0;
		$('.chat-modal').each(function() {
			var thisZ = parseInt($(this).css('zIndex'), 10);
			if (thisZ > topZ) {
				topZ = thisZ;
			}
		});
		chatModal.css('zIndex', topZ + 1);
	}

	module.getModal = function(touid) {
		return $('#chat-modal-' + touid);
	}

	module.modalExists = function(touid) {
		return $('#chat-modal-' + touid).length !== 0;
	}

	function checkStatus(chatModal, callback) {
		socket.emit('user.isOnline', chatModal.touid, function(err, data) {
			if(data.online !== chatModal.online) {
				if(data.online) {
					module.appendChatMessage(chatModal, chatModal.username + ' is currently online.\n', data.timestamp);
				} else {
					module.appendChatMessage(chatModal, chatModal.username + ' is currently offline.\n', data.timestamp);
				}
				chatModal.online = data.online;
			}
			if(callback)
				callback(data.online);
		});
	}

	function checkOnlineStatus(chatModal) {
		if(chatModal.intervalId === 0) {
			chatModal.intervalId = setInterval(function() {
				checkStatus(chatModal);
			}, 1000);
		}
	}

	module.createModal = function(username, touid, callback) {

		templates.preload_template('chat', function() {
			translator.translate(templates['chat'].parse({}), function (chatTpl) {

				var chatModal = $(chatTpl),
					uuid = utils.generateUUID();

				chatModal.intervalId = 0;
				chatModal.touid = touid;
				chatModal.username = username;

				chatModal.attr('id', 'chat-modal-' + touid);
				chatModal.attr('UUID', uuid);
				chatModal.css("position", "fixed");
				chatModal.appendTo($('body'));
				chatModal.draggable({
					start:function() {
						module.bringModalToTop(chatModal);
					}
				});

				chatModal.find('#chat-with-name').html(username);

				chatModal.find('.close').on('click', function(e) {
					clearInterval(chatModal.intervalId);
					chatModal.intervalId = 0;
					chatModal.remove();
					chatModal.data('modal', null);
					taskbar.discard('chat', uuid);
				});

				chatModal.on('click', function(e) {
					module.bringModalToTop(chatModal);
				});

				addSendHandler(chatModal);

				getChatMessages(chatModal, function() {
					checkOnlineStatus(chatModal);
				});

				taskbar.push('chat', chatModal.attr('UUID'), {
					title:'<i class="fa fa-comment"></i> ' + username,
					state: ''
				});

				callback(chatModal);
			});
		});
	}

	module.center = function(chatModal) {
		chatModal.css("left", Math.max(0, (($(window).width() - $(chatModal).outerWidth()) / 2) + $(window).scrollLeft()) + "px");
		chatModal.css("top", "0px");
		chatModal.css("zIndex", 2000);
		chatModal.find('#chat-message-input').focus();
		return chatModal;
	}

	module.load = function(uuid) {
		var chatModal = $('div[UUID="'+uuid+'"]');
		chatModal.removeClass('hide');
		module.bringModalToTop(chatModal);
		checkOnlineStatus(chatModal);
		taskbar.updateActive(uuid);
		scrollToBottom(chatModal.find('#chat-content'));
		module.center(chatModal);
	}

	module.minimize = function(uuid) {
		var chatModal = $('div[UUID="'+uuid+'"]');
		chatModal.addClass('hide');
		taskbar.minimize('chat', uuid);
		clearInterval(chatModal.intervalId);
		chatModal.intervalId = 0;
	}

	function getChatMessages(chatModal, callback) {
		socket.emit('modules.chats.get', {touid:chatModal.touid}, function(err, messages) {
			for(var i = 0; i<messages.length; ++i) {
				module.appendChatMessage(chatModal, messages[i].content, messages[i].timestamp);
			}
			callback();
		});
	}

	function addSendHandler(chatModal) {
		chatModal.find('#chat-message-input').off('keypress').on('keypress', function(e) {
			if(e.which === 13) {
				sendMessage(chatModal);
			}
		});

		chatModal.find('#chat-message-send-btn').off('click').on('click', function(e){
			sendMessage(chatModal);
			return false;
		});
	}

	function sendMessage(chatModal) {
		var msg = S(chatModal.find('#chat-message-input').val()).stripTags().s;
		if(msg.length) {
			msg = msg +'\n';
			socket.emit('modules.chats.send', { touid:chatModal.touid, message:msg});
			chatModal.find('#chat-message-input').val('');
		}
	}

	module.appendChatMessage = function(chatModal, message, timestamp) {
		var chatContent = chatModal.find('#chat-content');

		var date = new Date(parseInt(timestamp, 10));

        var prefix = '<span class="chat-timestamp">' + date.toLocaleTimeString() + '</span> ';
        message = '<li>' + S(prefix + message).stripTags('p').s + '</li>';

		chatContent.append(message);
		scrollToBottom(chatContent);
	};

	function scrollToBottom(chatContent) {
		if(chatContent[0]) {
			chatContent.scrollTop(
				chatContent[0].scrollHeight - chatContent.height()
			);
		}
	}

	module.toggleNew = function(uuid, state) {
		taskbar.toggleNew(uuid, state);
	};

	return module;
});