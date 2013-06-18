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
		chatModal.css('zIndex', topZ+1);
	}

	module.createModalIfDoesntExist = function(username, touid) {
		var chatModal = $('#chat-modal-'+touid);

		if(!chatModal.length) {
			var chatModal = $('#chat-modal').clone();
			chatModal.attr('id','chat-modal-'+touid);
			chatModal.appendTo($('body'));
			chatModal.draggable({
				start:function(){
					bringModalToTop(chatModal);
				}
			});
			chatModal.find('#chat-with-name').html(username);

			chatModal.find('.close').on('click',function(e){
				chatModal.hide();
			});

			chatModal.on('click', function(e){
				module.bringModalToTop(chatModal);
			});

			addSendHandler(chatModal, touid);	
		}

		return chatModal;
	}

	function addSendHandler(chatModal, touid) {
		chatModal.find('#chat-message-input').off('keypress');
		chatModal.find('#chat-message-input').on('keypress', function(e) {
			if(e.which === 13) {
				sendMessage(chatModal, touid);
			}
		});

		chatModal.find('#chat-message-send-btn').off('click');
		chatModal.find('#chat-message-send-btn').on('click', function(e){
			sendMessage(chatModal, touid);
			return false;
		});
	}

	function sendMessage(chatModal, touid) {
		var msg = app.strip_tags(chatModal.find('#chat-message-input').val());
		if(msg.length) {
			msg = msg +'\n';
			socket.emit('sendChatMessage', { touid:touid, message:msg});
			chatModal.find('#chat-message-input').val('');
			appendChatMessage(chatModal, 'You : ' + msg);
		}
	}

	socket.on('chatMessage', function(data){
		var username = data.username;
		var fromuid = data.fromuid;
		var message = data.message;

		var chatModal = module.createModalIfDoesntExist(username, fromuid);
		chatModal.show();
		module.bringModalToTop(chatModal);
	
		appendChatMessage(chatModal, message)
	});

	function appendChatMessage(chatModal, message){
		var chatContent = chatModal.find('#chat-content');
		chatContent.append(message);
		chatContent.scrollTop(
    		chatContent[0].scrollHeight - chatContent.height()
		);
	}

	return module;
});