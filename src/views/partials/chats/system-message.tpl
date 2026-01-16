<li component="chat/system-message" class="system-message text-muted small py-2 gap-3 d-flex align-items-center justify-content-center" data-mid="{messages.messageId}" data-uid="{messages.fromuid}" data-index="{messages.index}" data-self="{messages.self}" data-break="0" data-timestamp="{messages.timestamp}">
	<hr class="d-inline-block my-1" style="width: 10%;"/>
	<div>
		[[modules:chat.system.{messages.content}, {messages.fromUser.displayname}, {messages.timestampISO}]]
	</div>
	<hr class="d-inline-block my-1" style="width: 10%;"/>
</li>