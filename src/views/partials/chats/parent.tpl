<div class="d-flex ms-4 mb-2 align-items-center">
	<div component="chat/message/parent" data-parent-mid="{messages.parent.mid}" data-uid="{messages.parent.fromuid}" class="btn btn-ghost btn-sm d-flex gap-2 ff-secondary text-start flex-row w-100">
		<div class="d-flex gap-2 text-sm text-nowrap">
			<div class="d-flex flex-nowrap gap-1 align-items-center">
				<a href="{config.relative_path}/user/{messages.parent.user.userslug}" class="text-decoration-none lh-1">{buildAvatar(messages.parent.user, "14px", true, "not-responsive align-middle")}</a>
				<a class="chat-user fw-semibold text-truncate" style="max-width: 150px;" href="{config.relative_path}/user/{messages.parent.user.userslug}">{messages.parent.user.displayname}</a>
			</div>
			<span class="chat-timestamp text-muted timeago text-nowrap hidden" title="{messages.parent.timestampISO}"></span>
		</div>
		<div component="chat/message/parent/content" class="text-muted line-clamp-1 text-break w-100">{messages.parent.content}</div>
	</div>
</div>