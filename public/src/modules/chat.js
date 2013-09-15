define(['taskbar'], function(taskbar) {

	var module = {};

	module.bringModalToTop = function(chatModal) {
		var topZ = 0;
		$('.modal').each(function() {
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
		socket.emit('api:user.isOnline', chatModal.touid, function(data) {
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
			
		var chatModal = $('#chat-modal').clone(),
			uuid = utils.generateUUID();
			
		chatModal.intervalId = 0;
		chatModal.touid = touid;
		chatModal.username = username;

		chatModal.attr('id', 'chat-modal-' + touid);
		chatModal.attr('UUID', uuid);
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
			chatModal.hide();
			taskbar.discard('chat', uuid);
		});

		chatModal.on('click', function(e) {
			module.bringModalToTop(chatModal);
		});
		
		addSendHandler(chatModal);

		getChatMessages(chatModal, function() {
			checkOnlineStatus(chatModal);
		});

		taskbar.push('chat', chatModal.attr('UUID'), {title:'chat with ' + username});
		return chatModal;
	}

	module.load = function(uuid) {
		var chatModal = $('div[UUID="'+uuid+'"]');
		chatModal.show();
		module.bringModalToTop(chatModal);
		checkOnlineStatus(chatModal);
	}

	module.minimize = function(uuid) {
		var chatModal = $('div[UUID="'+uuid+'"]');
		chatModal.hide();
		taskbar.minimize('chat', uuid);
		clearInterval(chatModal.intervalId);
		chatModal.intervalId = 0;
	}

	function getChatMessages(chatModal, callback) {
		socket.emit('getChatMessages', {touid:chatModal.touid}, function(messages) {
			for(var i = 0; i<messages.length; ++i) {
				module.appendChatMessage(chatModal, messages[i].content, messages[i].timestamp);
			}
			callback();
		});
	}

	function addSendHandler(chatModal) {
		chatModal.find('#chat-message-input').off('keypress');
		chatModal.find('#chat-message-input').on('keypress', function(e) {
			if(e.which === 13) {
				sendMessage(chatModal);
			}
		});

		chatModal.find('#chat-message-send-btn').off('click');
		chatModal.find('#chat-message-send-btn').on('click', function(e){
			sendMessage(chatModal);
			return false;
		});
	}

	function sendMessage(chatModal) {
		var msg = app.strip_tags(chatModal.find('#chat-message-input').val());
		if(msg.length) {
			msg = msg +'\n';
			socket.emit('sendChatMessage', { touid:chatModal.touid, message:msg});
			chatModal.find('#chat-message-input').val('');
		}
	}

	module.appendChatMessage = function(chatModal, message, timestamp) {
		var chatContent = chatModal.find('#chat-content');

		var date = new Date(parseInt(timestamp, 10));

		chatContent.append('[' + date.toLocaleTimeString() + '] ' + message);
		chatContent.scrollTop(
			chatContent[0].scrollHeight - chatContent.height()
		);
	}

	return module;
});