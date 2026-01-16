<div class="flex-fill">
	{{{ if isAdmin }}}
	{{{ if !enabled }}}
	<div class="alert alert-info">
		[[post-queue:enabling-help, {config.relative_path}/admin/settings/post#post-queue]]
	</div>
	{{{ end }}}
	{{{ else }}}
	<div>
		<p class="lead">[[post-queue:public-intro]]</p>
		<p>[[post-queue:public-description]]</p>
		<hr />
	</div>
	{{{ end }}}

	{{{ if (!singlePost && posts.length) }}}
	<div class="btn-toolbar justify-content-end mb-3">
		<div class="me-2">
		<!-- IMPORT partials/category/filter-dropdown-right.tpl -->
		</div>

		<div class="btn-group bottom-sheet" component="post-queue/bulk-actions">
			<button type="button" class="btn btn-ghost btn-sm ff-secondary dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown" autocomplete="off" aria-haspopup="true" aria-expanded="false">
				<i class="fa fa-clone text-primary"></i><span class="fw-semibold"> [[post-queue:bulk-actions]]</span>
			</button>
			<ul class="dropdown-menu p-1 text-sm dropdown-menu-end" role="menu">
				{{{ if canAccept }}}
				<li><a class="dropdown-item rounded-1" href="#" data-action="accept-all" role="menuitem">[[post-queue:accept-all]]</a></li>
				<li><a class="dropdown-item rounded-1" href="#" data-action="accept-selected" role="menuitem">[[post-queue:accept-selected]]</a></li>
				<li class="dropdown-divider"></li>
				<li><a class="dropdown-item rounded-1" href="#" data-action="reject-all" role="menuitem">[[post-queue:reject-all]]</a></li>
				<li><a class="dropdown-item rounded-1" href="#" data-action="reject-selected" role="menuitem">[[post-queue:reject-selected]]</a></li>
				{{{ else }}}
				<li><a class="dropdown-item rounded-1" href="#" data-action="reject-all" role="menuitem">[[post-queue:remove-all]]</a></li>
				<li><a class="dropdown-item rounded-1" href="#" data-action="reject-selected" role="menuitem">[[post-queue:remove-selected]]</a></li>
				{{{ end }}}
			</ul>
		</div>
	</div>
	{{{ end }}}

	<div class="post-queue posts-list">
		{{{ if !posts.length }}}
			{{{ if !singlePost }}}
			<div class="mx-auto">
				<div class="d-flex flex-column gap-3 justify-content-center text-center">
					<div class="mx-auto p-4 bg-light border rounded">
						<i class="text-secondary fa fa-fw fa-4x fa-seedling"></i>
					</div>
					[[post-queue:no-queued-posts]]
				</div>
			</div>
			{{{ else }}}
			<div class="alert alert-info d-flex align-items-md-center d-flex flex-column flex-md-row">
				<p class="mb-md-0">[[post-queue:no-single-post]]</p>
				<div class="d-grid ms-md-auto">
					<a class="btn btn-sm btn-primary flex-shrink text-nowrap" href=".">[[post-queue:back-to-list]]</a>
				</div>
			</div>
			{{{ end }}}
		{{{ end }}}

		{{{ each posts }}}
		<div class="card mb-4" data-id="{./id}" data-uid="{./user.uid}">
			<div class="row g-0">
				<div class="col-lg-3 bg-card-cap rounded-start">
					<ul class="list-unstyled ps-0 mb-0 border-end h-100">
						<li class="card-body border-bottom position-relative">
							{{{ if !singlePost }}}
							<input id="{./id}" type="checkbox" class="form-check-input" autocomplete="off" />
							{{{ end }}}
							<label for="{./id}" class="small stretched-link">
								{{{ if posts.data.tid }}}[[post-queue:reply]]{{{ else }}}[[post-queue:topic]]{{{ end }}}
							</label>
						</li>
						<li class="card-body d-flex flex-column gap-1 border-bottom">
							<div class="d-flex text-xs fw-semibold align-items-center">
								[[post-queue:user]]
								{{{ if ((privileges.ban || privileges.mute) || privileges.admin:users) }}}
								<div class="ms-auto btn-group bottom-sheet">
									<button href="#" class="btn btn-ghost btn-sm ff-secondary border text-xs dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">[[global:actions]]</button>
									<ul class="dropdown-menu p-1 text-sm" role="menu">
										{{{ if privileges.view:users:info }}}
										<li><a class="dropdown-item rounded-1" href="{config.relative_path}/user/{./user.userslug}/info" role="menuitem">[[user:account-info]]</a></li>
										{{{ end }}}
										{{{ if privileges.ban }}}
										<li class="{{{ if target.user.banned }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="ban" role="menuitem">[[user:ban-account]]</a></li>
										<li class="{{{ if !target.user.banned }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="unban" role="menuitem">[[user:unban-account]]</a></li>
										{{{ end }}}
										{{{ if privileges.mute}}}
										<li class="{{{ if target.user.muted }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="mute" role="menuitem">[[user:mute-account]]</a></li>
										<li class="{{{ if !target.user.muted }}}hidden{{{ end }}}"><a class="dropdown-item rounded-1" href="#" data-action="unmute" role="menuitem">[[user:unmute-account]]</a></li>
										{{{ end }}}
										{{{ if privileges.admin:users }}}
										<li><a class="dropdown-item rounded-1" href="#" data-action="delete-account" role="menuitem">[[user:delete-account-as-admin]]</a></li>
										<li><a class="dropdown-item rounded-1" href="#" data-action="delete-content" role="menuitem">[[user:delete-content]]</a></li>
										<li><a class="dropdown-item rounded-1" href="#" data-action="delete-all" role="menuitem">[[user:delete-all]]</a></li>
										{{{ end }}}
									</ul>
								</div>
								{{{ end }}}
							</div>
							<div class="small">
								{{{ if posts.user.userslug}}}
								<a class="text-decoration-none" href="{config.relative_path}/uid/{posts.user.uid}">{buildAvatar(posts.user, "24px", true, "not-responsive")} {posts.user.username}</a>
								{{{ else }}}
								{posts.user.username}
								{{{ end }}}
							</div>
							<div>
								<span class="badge text-body border border-gray-300 stats text-xs">
									<span title="{posts.user.postcount}" class="fw-bold">{humanReadableNumber(posts.user.postcount)}</span>
									<span class="text-lowercase fw-normal">[[global:posts]]</span>
								</span>
								<span class="badge text-body border border-gray-300 stats text-xs">
									<span title="{posts.user.reputation}" class="fw-bold">{humanReadableNumber(posts.user.reputation)}</span>
									<span class="text-lowercase fw-normal">[[global:reputation]]</span>
								</span>
								<span class="badge text-body border border-gray-300 stats text-xs">
									<span class="text-lowercase fw-normal">[[user:joined]]</span>
									<span title="{posts.user.joindateISO}" class="timeago fw-bold"></span>
								</span>
							</div>
						</li>
						<li class="card-body border-bottom">
							<div class="text-xs fw-semibold mb-1">[[post-queue:when]]</div>
							<span class="small timeago" title={posts.data.timestampISO}></span>
						</li>
						<li class="card-body border-bottom">
							<div class="text-xs fw-semibold mb-1">
								{{{ if posts.data.tid }}}[[post-queue:topic]]{{{ else }}}[[post-queue:title]]{{{ end }}}
							</div>
							<span class="small topic-title text-break">
								{{{ if posts.data.tid }}}
								<div class="d-flex flex-column align-items-start gap-1">
									<a href="{config.relative_path}/topic/{posts.data.tid}">{posts.topic.title}</a>
									<span class="badge text-body border border-gray-300 stats text-xs">
										<span class="text-lowercase fw-normal">[[global:lastpost]]</span>
										<span title="{posts.topic.lastposttimeISO}" class="timeago fw-bold"></span>
									</span>
								</div>
								{{{ end }}}
								<span class="title-text">{posts.data.title}</span>
							</span>
							{{{if !posts.data.tid}}}
							<div class="topic-title-editable hidden">
								<input class="form-control" type="text" value="{posts.data.title}"/>
							</div>
							{{{end}}}
						</li>
						<li class="card-body border-bottom">
							<div class="text-xs fw-semibold mb-1">
								[[post-queue:category]]
							</div>
							<div class="topic-category small">
								<a href="{config.relative_path}/category/{posts.category.slug}">
									<div class="category-item d-inline-block">
										{buildCategoryIcon(./category, "24px", "rounded-circle")}
										{posts.category.name}
									</div>
								</a>
							</div>
						</li>
						<li class="card-body">
							<div class="row row-cols-2 g-1">
								{{{ if ./canAccept }}}
								<div class="col d-grid">
									<button class="btn btn-success btn-sm" data-action="accept"><i class="fa fa-fw fa-check"></i> [[post-queue:accept]] </button>
								</div>
								<div class="col d-grid">
									<button class="btn btn-danger btn-sm" data-action="reject"><i class="fa fa-fw fa-times"></i> [[post-queue:reject]]</button>
								</div>
								{{{ end }}}
								{{{ if ./canEdit}}}
								{{{ if !posts.data.tid }}}
								<div class="col d-grid">
									<button class="btn btn-light btn-sm" data-action="editTitle"><i class="fa fa-fw fa-edit"></i> [[post-queue:title]]</button>
								</div>
								{{{ end }}}
								<div class="col d-grid">
									<button class="btn btn-light btn-sm" data-action="editContent"><i class="fa fa-fw fa-edit"></i> [[post-queue:content]]</button>
								</div>
								{{{if posts.data.cid}}}
								<div class="col d-grid">
									<button class="btn btn-light btn-sm" data-action="editCategory"><i class="fa fa-fw fa-edit"></i> [[post-queue:category]]</button>
								</div>
								{{{ end }}}
								{{{ end }}}
								{{{ if ./canAccept }}}
								<div class="col d-grid">
									<button class="btn btn-light btn-sm" data-action="notify"><i class="fa fa-fw fa-bell-o"></i> [[post-queue:notify]]</button>
								</div>
								{{{ else }}}
								<div class="col d-grid">
									<button class="btn btn-danger btn-sm" data-action="reject"><i class="fa fa-fw fa-times"></i> [[post-queue:remove]]</button>
								</div>
								{{{ end }}}
							</div>
						</li>
					</ul>
				</div>
				<div class="col-lg-9 d-flex flex-column">
					<div class="post-content mb-auto text-break p-3 pb-0 h-100">{posts.data.content}</div>
					<div class="post-content-editable flex-grow-1 hidden">
						<textarea class="form-control w-100 h-100 p-3">{posts.data.rawContent}</textarea>
					</div>
					<div component="post-queue/link-container" class="hidden border-top mx-3 py-3">
						<label class="text-secondary form-text mb-2">[[post-queue:links-in-this-post]]</label>
						<ul component="post-queue/link-container/list" class="text-sm"></ul>
					</div>
				</div>
			</div>
		</div>
		{{{ end }}}
	</div>

	<!-- IMPORT partials/paginator.tpl -->
</div>