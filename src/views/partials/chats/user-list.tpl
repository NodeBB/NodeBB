<div component="chat/user/list" class="border-start hidden d-flex flex-column gap-1 p-1 overflow-auto ghost-scrollbar" style="min-width:240px; width: 240px;">
	{{{ each users }}}
	<a data-index="{./index}" data-uid="{./uid}" class="btn btn-ghost btn-sm d-flex ff-secondary d-flex justify-content-start align-items-center gap-2 {{{ if ./online }}}online{{{ end}}}" href="{config.relative_path}/uid/{./uid}">
		<div>{buildAvatar(users, "24px", true)}</div>
		<div class="d-flex gap-1 flex-grow-1 text-nowrap text-truncate">
			<span component="chat/user/list/username" class="text-truncate">{./displayname}</span>
			{{{ if ./isOwner }}}<span><i class="fa fa-star text-warning" data-bs-toggle="tooltip" title="[[modules:chat.owner]]"></i></span>{{{ end }}}
		</div>
	</a>
	{{{ end }}}
</div>