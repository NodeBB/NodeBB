
<div id="chat-modal" class="chat-modal hide" tabindex="-1" role="dialog" aria-labelledby="Chat" aria-hidden="true" data-backdrop="none">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				<h4>[[footer:chat.chatting_with]]</h4>
			</div>
			<div class="modal-body">
				<textarea class="form-control" id="chat-content" cols="40" rows="10" readonly></textarea><br/>
				<input id="chat-message-input" type="text" class="form-control" name="chat-message" placeholder="[[footer:chat.placeholder]]"/>
			</div>
			<div class="modal-footer">
				<button type="button" id="chat-message-send-btn" href="#" class="btn btn-primary btn-lg btn-block">[[footer:chat.send]]</button>
			</div>
		</div>
	</div>
</div>