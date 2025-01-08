{{{ if (loadingMore && @first)}}}
<hr class="my-1" />
{{{ end }}}
<div component="chat/recent/room" data-roomid="{./roomId}" data-full="1" class="rounded-1 {{{ if ./unread }}}unread{{{ end }}}">
	<div class="d-flex gap-1 justify-content-between">
		<a href="#" class="chat-room-btn position-relative d-flex flex-grow-1 gap-2 justify-content-start align-items-start btn btn-ghost btn-sm ff-sans text-start">
			<div class="main-avatar">
				{{{ if ./users.length }}}
				{{{ if ./groupChat}}}
				<div class="position-relative stacked-avatars">
					<span class="text-decoration-none position-absolute" href="{config.relative_path}/user/{./users.1.userslug}">{buildAvatar(./users.1, "24px", true)}</span>
					<span class="text-decoration-none position-absolute" href="{config.relative_path}/user/{./users.0.userslug}" >{buildAvatar(./users.0, "24px", true)}</span>
				</div>
				{{{ else }}}
				<span href="{config.relative_path}/user/{./users.0.userslug}" class="text-decoration-none">{buildAvatar(./users.0, "32px", true)}</span>
				{{{ end }}}
				{{{ else }}}
				<span class="avatar avatar-rounded text-bg-warning" component="avatar/icon" style="--avatar-size: 32px;">?</span>
				{{{ end }}}
			</div>

			<div class="d-flex flex-grow-1 flex-column w-100">
				<div component="chat/room/title" class="room-name fw-semibold text-xs text-break">
				{{{ if ./roomName}}}
				{./roomName}
				{{{ else }}}
					{{{ if !./lastUser.uid }}}
					[[modules:chat.no-users-in-room]]
					{{{ else }}}
					{./usernames}
					{{{ end  }}}
				{{{ end }}}
				</div>
				<!-- IMPORT partials/chats/room-teaser.tpl -->
			</div>
		</a>
		<div>
			<button class="mark-read btn btn-ghost btn-sm d-flex align-items-center justify-content-center flex-grow-0 flex-shrink-0 p-1" style="width: 1.5rem; height: 1.5rem;">
				<i class="unread fa fa-2xs fa-circle text-primary {{{ if !./unread }}}hidden{{{ end }}}" aria-label="[[unread:mark-as-read]]"></i>
				<i class="read fa fa-2xs fa-circle-o text-secondary {{{ if ./unread }}}hidden{{{ end }}}" aria-label="[[unread:mark-as-unread]]"></i>
			</button>
		</div>
	</div>
</div>
{{{ if !@last }}}
<hr class="my-1" />
{{{ else }}}
{{{ if showBottomHr }}}
<hr class="my-1" />
{{{ end }}}
{{{ end }}}
