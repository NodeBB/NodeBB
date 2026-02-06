<li component="category/topic" data-tid="{./topic.tid}" class="shadow-sm mb-3 rounded-2 border posts-list-item  {{{ if ./deleted }}} deleted{{{ else }}}{{{ if ./topic.deleted }}} deleted{{{ end }}}{{{ end }}}{{{ if ./topic.scheduled }}} scheduled{{{ end }}}" data-pid="{./pid}" data-uid="{./uid}" data-index="{./index}">
	{{{ if (showThumbs && ./topic.thumbs.length)}}}
	<div class="p-1 position-relative">
		<div class="overflow-hidden rounded-1" style="max-height: 300px;">
			<a href="{config.relative_path}/topic/{./topic.slug}">
				<img class="w-100" src="{./topic.thumbs.0.url}">
			</a>
		</div>

		<div component="topic/thumb/list" class="position-absolute end-0 bottom-0 p-3 d-flex gap-2  pe-none {{{ if greaterthan(./topic.thumbs.length, "4") }}}thumbs-collapsed{{{ end }}}">
			{{{ each ./topic.thumbs }}}
			{{{ if (@index != 0) }}}
			<img class="rounded-1" style="max-height: 64px; object-fit: contain;" src="{./url}">
			{{{ end }}}
			{{{ end }}}
			{{{ if greaterthan(./topic.thumbs.length, "4") }}}
			<div class="btn btn-light fw-semibold d-flex align-items-center" style="max-height:64px; contain;">+{increment(./topic.thumbs.length, "-3")}</div>
			{{{ end }}}
		</div>
	</div>
	{{{ end }}}

	<div class="d-flex gap-3 p-3">
		<div class="d-none d-lg-block">
			<a class="lh-1 text-decoration-none" href="{config.relative_path}/user/{./user.userslug}">{buildAvatar(./user, "40px", true, "not-responsive")}</a>
		</div>
		<div class="post-body d-flex flex-column gap-2 flex-grow-1 hover-parent" style="min-width: 0px;">
			<div class="d-flex flex-column gap-2 post-info">
				<div class="d-flex gap-2 text-truncate">
					<div class="text-sm">
						<div class="post-author d-flex align-items-center gap-1">
							<a class="d-inline d-lg-none lh-1 text-decoration-none" href="{config.relative_path}/user/{./user.userslug}">{buildAvatar(./user, "16px", true, "not-responsive")}</a>
							<a class="lh-normal fw-semibold text-nowrap" href="{config.relative_path}/user/{./user.userslug}">{./user.displayname}</a>
						</div>
						<span class="timeago text-muted lh-normal" title="{./timestampISO}"></span>
					</div>
					<div class="ms-auto">
						{{{ if (./category.cid != "-1") }}}
						{buildCategoryLabel(./category, "a", "border text-xs flex-shrink-0")}
						{{{ end }}}
						{{{ if showSelect }}}
						<div class="checkbox ms-auto" style="max-width:max-content">
							<i component="topic/select" class="fa text-muted pointer fa-square-o p-1"></i>
						</div>
						{{{ end }}}
					</div>
				</div>
				<div>
					{{{ if !./topic.generatedTitle }}}
					<a class="lh-1 topic-title fw-semibold fs-5 text-reset line-clamp-2" href="{config.relative_path}/topic/{./topic.slug}">
						{./topic.title}
					</a>
					{{{ end }}}
				</div>
			</div>

			<div component="post/content" class="content text-sm text-break position-relative truncate-post-content">
				<a href="{config.relative_path}/post/{./pid}" class="stretched-link"></a>
				{./content}
			</div>
			<div class="position-relative hover-visible">
				<button component="show/more" class="btn btn-light btn-sm rounded-pill position-absolute start-50 translate-middle-x bottom-0 z-1 hidden ff-secondary">[[feed:see-more]]</button>
			</div>
			<hr class="my-2"/>
			<div class="d-flex justify-content-between">
				<a href="{config.relative_path}/post/{{{ if ./topic.teaserPid }}}{encodeURIComponent(./topic.teaserPid)}{{{ else }}}{encodeURIComponent(./pid)){{{ end }}}" class="btn btn-link btn-sm text-body {{{ if !./isMainPost }}}invisible{{{ end }}}"><i class="fa-fw fa-regular fa-message text-muted"></i> {humanReadableNumber(./topic.postcount)}</a>

				<a href="#" data-pid="{./pid}" data-action="bookmark" data-bookmarked="{./bookmarked}" data-bookmarks="{./bookmarks}" class="btn btn-link btn-sm text-body"><i class="fa-fw fa-bookmark {{{ if ./bookmarked }}}fa text-primary{{{ else }}}fa-regular text-muted{{{ end }}}"></i> <span component="bookmark-count">{humanReadableNumber(./bookmarks)}</span></a>

				<a href="#" data-pid="{./pid}" data-action="upvote" data-upvoted="{./upvoted}" data-upvotes="{./upvotes}" class="btn btn-link btn-sm text-body"><i class="fa-fw fa-heart {{{ if ./upvoted }}}fa text-danger{{{ else }}}fa-regular text-muted{{{ end }}}"></i> <span component="upvote-count">{humanReadableNumber(./upvotes)}</span></a>

				<a href="#" data-pid="{./pid}" data-is-main="{./isMainPost}" data-tid="{./tid}" data-action="reply" class="btn btn-link btn-sm text-body"><i class="fa-fw fa fa-reply text-muted"></i> [[topic:reply]]</a>
			</div>
			{{{ if ./topic.teaser }}}
			<div class="d-flex flex-column gap-2 mt-1 text-xs border-start ps-3">
				{{{ if (./replies && (./replies != "1")) }}}
				<a href="{config.relative_path}/post/{./pid}" class="text-capitalize fw-semibold text-secondary">[[global:read-more]] &rarr;</a>
				{{{ end }}}
				<div class="d-inline-flex flex-column px-3 py-2 rounded gap-2 bg-body-tertiary align-self-start">
					<div class="d-flex align-items-top gap-2">
						<a class="text-decoration-none avatar-tooltip" title="{./topic.teaser.user.displayname}" href="{config.relative_path}/user/{./topic.teaser.user.userslug}">{buildAvatar(./topic.teaser.user, "18px", true)} {./topic.teaser.user.displayname}</a>
						<a class="permalink text-muted timeago text-xs" href="{config.relative_path}/topic/{./topic.slug}{{{ if ./index }}}/{./index}{{{ end }}}" title="{./topic.teaser.timestampISO}" aria-label="[[global:lastpost]]"></a>
					</div>
					<div class="post-content text-xs text-break line-clamp-sm-2 lh-sm position-relative flex-fill">
						<a class="stretched-link" tabindex="-1" href="{config.relative_path}/topic/{./topic.slug}{{{ if ./topic.teaser.index }}}/{./topic.teaser.index}{{{ end }}}" aria-label="[[global:lastpost]]"></a>
						{./topic.teaser.content}
					</div>
				</div>
			</div>
			{{{ end }}}
			<div>

			</div>
		</div>
	</div>
</li>