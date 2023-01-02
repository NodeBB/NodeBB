<!-- IF roomId -->
<div component="chat/messages" class="expanded-chat" data-roomid="{roomId}">
	<div component="chat/header">
		<button type="button" class="close" aria-label="Close" data-action="close"><span aria-hidden="true">&times;</span></button>
		<button type="button" class="close" data-action="pop-out"><span aria-hidden="true"><i class="fa fa-compress"></i></span><span class="sr-only">[[modules:chat.pop-out]]</span></button>

		<!-- IMPORT partials/chats/options.tpl -->
		<span class="members">
			[[modules:chat.chatting_with]]:
			{{{each users}}}
			<a href="{config.relative_path}/uid/{../uid}">{../username}</a><!-- IF !@last -->,<!-- END -->
			{{{end}}}
		</span>
	</div>
	<div component="chat/messages/scroll-up-alert" class="scroll-up-alert alert alert-info" role="button">[[modules:chat.scroll-up-alert]]</div>
	<ul class="chat-content">
		<!-- IMPORT partials/chats/messages.tpl -->
	</ul>
	<div component="chat/composer">
		<textarea component="chat/input" placeholder="[[modules:chat.placeholder]]" class="form-control chat-input mousetrap" rows="2"></textarea>
		<button class="btn btn-primary" type="button" data-action="send"><i class="fa fa-fw fa-2x fa-paper-plane"></i></button>
		<span component="chat/message/remaining">{maximumChatMessageLength}</span>
		<form component="chat/upload" method="post" enctype="multipart/form-data">
			<input type="file" name="files[]" multiple class="hidden"/>
		</form>
	</div>
</div>
<!-- ELSE -->
<div class="alert alert-info">
	[[modules:chat.no-messages]]
</div>
<!-- ENDIF roomId -->