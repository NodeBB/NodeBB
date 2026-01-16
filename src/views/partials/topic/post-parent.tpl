<div component="post/parent" data-collapsed="true" data-parent-pid="{./parent.pid}" data-uid="{./parent.uid}" class="btn btn-ghost btn-sm d-flex gap-2 text-start flex-row mb-2" style="font-size: 13px;">
	<div class="d-flex gap-2 text-nowrap">
		<div class="d-flex flex-nowrap gap-1 align-items-center">
			<a href="{config.relative_path}/user/{./parent.user.userslug}" class="text-decoration-none lh-1">{buildAvatar(./parent.user, "16px", true, "not-responsive align-middle")}</a>
			<a class="fw-semibold text-truncate" style="max-width: 150px;" href="{config.relative_path}/user/{./parent.user.userslug}">{./parent.user.displayname}</a>
		</div>

		<a href="{config.relative_path}/post/{encodeURIComponent(./parent.pid)}" class="text-muted timeago text-nowrap hidden" title="{./parent.timestampISO}"></a>
	</div>
	<div component="post/parent/content" class="text-muted line-clamp-1 text-break w-100">{./parent.content}</div>
</div>
