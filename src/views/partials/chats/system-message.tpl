<li component="chat/system-message" class="system-message text-muted small py-4 py-md-2 gap-3 d-flex align-items-center justify-content-center" data-mid="{messages.messageId}" data-uid="{messages.fromuid}" data-index="{messages.index}" data-self="{messages.self}" data-break="0" data-timestamp="{messages.timestamp}">
	<hr class="d-none d-md-inline-block my-1" style="width: 10%;"/>
	<div>
		{{tx(messages.content)}}
	</div>
	<hr class="d-none d-md-inline-block my-1" style="width: 10%;"/>
</li>