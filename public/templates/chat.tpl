
<div id="chat-modal" class="chat-modal hide" tabindex="-1" role="dialog" aria-labelledby="Chat" aria-hidden="true" data-backdrop="none">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">

				<h4>[[modules:chat.chatting_with]] <i id="chat-user-status" class="fa fa-circle status offline" title="[[global:offline]]"></i></h4>

			</div>
			<div class="modal-body">
				<ul id="chat-content" class="well well-sm"></ul>
				<div class="input-group">
					<input id="chat-message-input" type="text" placeholder="[[modules:chat.placeholder]]" name="chat-message" class="form-control">
					<span class="input-group-btn">
						<button id="chat-message-send-btn" class="btn btn-primary" href="#" type="button">[[modules:chat.send]]</button>
						<button id="chat-close-btn" class="btn btn-warning" data-dismiss="modal" aria-hidden="true">[[global:close]]</button>
					</span>
				</div>
			</div>
		</div>
	</div>
</div>