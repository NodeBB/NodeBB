<div component="chat/composer" class="d-flex flex-column border-top pt-2 align-items-start">
	<div component="chat/composer/replying-to" data-tomid="" class="text-sm px-2 mb-1 d-flex gap-2 align-items-center hidden">
		<div component="chat/composer/replying-to-text"></div> <button component="chat/composer/replying-to-cancel" class="btn btn-ghost btn-sm px-2 py-1"><i class="fa fa-times"></i></button>
	</div>
	<div class="w-100 flex-grow-1 flex-nowrap position-relative d-flex rounded-2 border border-secondary p-1 align-items-end">
		{{{ if canUpload }}}
		<button component="chat/upload/button" class="btn btn-ghost btn-sm d-flex p-2" type="button" title="[[global:upload]]" data-bs-toggle="tooltip"><i class="fa fa-fw fa-upload"></i></button>
		{{{ end }}}
		<div class="flex-grow-1 align-self-center">
			<textarea component="chat/input" placeholder="{{{ if roomName }}}[[modules:chat.placeholder.message-room, {roomName}]]{{{ else }}}[[modules:chat.placeholder.mobile]]{{{ end }}}" class="bg-transparent text-body form-control chat-input mousetrap rounded-0 border-0 shadow-none px-1 py-0" style="min-height: 1.5rem;height:0;max-height:30vh;resize:none;"></textarea>
		</div>
		<div class="d-flex gap-1">
			{{{ each composerActions }}}
			<button data-action="{./action}" class="btn btn-ghost btn-sm d-flex p-2 {./class}" type="button" title="{./title}" data-bs-toggle="tooltip"><i class="fa {./icon}"></i></button>
			{{{ end }}}
			<button class="btn btn-ghost btn-sm d-flex p-2" type="button" data-action="send" title="[[modules:chat.send]]" data-bs-toggle="tooltip"><i class="fa fa-fw fa-paper-plane text-primary"></i></button>
		</div>
	</div>
	<div class="d-flex justify-content-between align-items-center text-xs w-100 px-2 mt-1">
		<div component="chat/composer/typing" class="">
			<div component="chat/composer/typing/users" class="hidden"></div>
			<div component="chat/composer/typing/text" class="hidden"></div>
		</div>
		<div component="chat/message/remaining" class="text-xs text-muted">{maximumChatMessageLength}</div>
	</div>
	<form class="hidden" component="chat/upload" method="post" enctype="multipart/form-data">
		<input type="file" name="files[]" multiple class="hidden"/>
	</form>
</div>