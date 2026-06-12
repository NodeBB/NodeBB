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

		<div class="dropdown bottom-sheet" component="post-queue/bulk-actions">
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
								{{{ if posts.data.crosspostCid }}}
									[[post-queue:crosspost]]
								{{{ else }}}
									{{{ if posts.data.tid }}}[[post-queue:reply]]{{{ end }}}
									{{{ if posts.data.cid }}}[[post-queue:topic]]{{{ end }}}
								{{{ end }}}
							</label>
						</li>
						<li class="card-body d-flex flex-column gap-1 border-bottom">
							<div class="d-flex text-xs fw-semibold align-items-center">
								[[post-queue:user]]
								{{{ if ((privileges.ban || privileges.mute) || privileges.admin:users) }}}
								<div class="ms-auto dropdown bottom-sheet">
									<button href="#" class="btn btn-ghost btn-sm ff-secondary border text-xs dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">[[global:actions]]</button>
									<ul class="dropdown-menu p-1 text-sm" role="menu">
										{{{ if ./canAccept }}}
										<li><a class="dropdown-item rounded-1" data-action="notify"> [[post-queue:notify]]</a></li>
										<li class="dropdown-divider"></li>
										{{{ end }}}
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
							<div class="text-sm lh-1">
								{{{ if posts.user.userslug}}}
								<a class="text-decoration-none d-flex align-items-center gap-1" href="{config.relative_path}/uid/{posts.user.uid}">{{buildAvatar(posts.user, "24px", true, "not-responsive")}} {posts.user.username}</a>
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
							<div class="d-flex align-items-center justify-content-between mb-1">
								<span class="text-xs fw-semibold">
								{{{ if posts.data.tid }}}[[post-queue:topic]]{{{ else }}}[[post-queue:title]]{{{ end }}}
								</span>
								{{{ if !posts.data.tid }}}
								<button data-action="editTitle" class="btn btn-ghost btn-sm ff-secondary border text-xs">Edit</button>
								{{{ end }}}
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
								<input class="form-control form-control-sm" type="text" value="{posts.data.title}"/>
							</div>
							{{{end}}}
						</li>

						<li class="card-body border-bottom">
							<div class="d-flex align-items-center justify-content-between mb-1">
								<div class="text-xs fw-semibold">
									[[post-queue:category]]
								</div>
								{{{ if posts.data.cid }}}
								<button data-action="editCategory" class="btn btn-ghost btn-sm ff-secondary border text-xs">Edit</button>
								{{{ end }}}
							</div>

							<div class="topic-category">
								<a href="{config.relative_path}/category/{posts.category.slug}">
									<div class="category-item d-inline-block">
										{{buildCategoryIcon(./category, "24px", "rounded-circle")}}
										<span class="text-sm">{posts.category.name}</span>
									</div>
								</a>
							</div>
						</li>

						{{{ if (./type == "crosspost") }}}
						<li class="card-body border-bottom" data-crosspost>
							<div class="d-flex align-items-center justify-content-between mb-1">
								<div class="text-xs fw-semibold">
									[[post-queue:crosspost-to]]
								</div>
								<button data-action="editCategory" class="btn btn-ghost btn-sm ff-secondary border text-xs">Edit</button>
							</div>

							<div class="topic-category">
								<a href="{config.relative_path}/category/{posts.crosspostCategory.slug}">
									<div class="category-item d-inline-block">
										{{buildCategoryIcon(./crosspostCategory, "24px", "rounded-circle")}}
										<span class="text-sm">{posts.crosspostCategory.name}</span>
									</div>
								</a>
							</div>
						</li>
						{{{ end }}}

						{{{ if (posts.type == "topic") }}}
						<li class="card-body border-bottom">
							<div class="d-flex align-items-center justify-content-between mb-1">
								<div class="text-xs fw-semibold">
									[[post-queue:tags]]
								</div>

								<button data-action="editTags" class="btn btn-ghost btn-sm ff-secondary border text-xs">Edit</button>
							</div>
							<div class="tag-list">
								{{{ each posts.data.tags }}}
								<a href="{config.relative_path}/tags/{encodeURIComponent(@value)}"><span class="badge border border-gray-300 fw-normal tag">{@value}</span></a>
								{{{ end }}}
							</div>
							<div class="topic-tags-editable hidden">
								<input class="form-control form-control-sm tags" type="text" value=""/>
							</div>
						</li>
						{{{ end }}}

						<li class="card-body">
							<div class="row row-cols-2 g-1">
								{{{ if ./canAccept }}}
								<div class="col d-grid">
									<button class="btn btn-success btn-sm" data-action="accept"><i class="fa fa-fw fa-check"></i> [[post-queue:accept]] </button>
								</div>
								<div class="col d-grid">
									<button class="btn btn-danger btn-sm" data-action="reject"><i class="fa fa-fw fa-times"></i> [[post-queue:reject]]</button>
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
					<div class="d-flex align-items-center justify-content-between mb-1 px-3 pt-3 pb-1">
						<div class="text-xs fw-semibold">
							[[post-queue:content]]
						</div>
						{{{ if ./canEdit }}}
						<button data-action="editContent" class="btn btn-ghost btn-sm ff-secondary border text-xs">Edit</button>
						{{{ end }}}
					</div>
					<div class="post-content mb-auto text-break px-3 py-0 h-100">{{posts.data.content}}</div>
					<div class="post-content-editable flex-grow-1 hidden">
						<textarea class="form-control w-100 h-100 p-3">{posts.data.rawContent}</textarea>
					</div>
					<div component="post-queue/link-container" class="hidden border-top mx-3 py-3">
						<label class="text-secondary form-text mb-2">[[post-queue:links-in-this-post]]</label>
						<ul component="post-queue/link-container/list" class="text-sm"></ul>
					</div>
					{{{ if (posts.type == "topic") }}}
					<div class="border-top mx-3 py-3">
						<label class="text-secondary form-text mb-2">[[post-queue:thumbs-in-this-post]]</label>
						<div class="thumb-list d-flex gap-3 flex-wrap">
							{{{ each posts.data.thumbs }}}
							<div class="position-relative">
								<a class="d-inline-block" href="#">
									<img class="rounded-1 bg-light" style="width:auto; max-width: 5.33rem; height: 3.33rem; object-fit: contain;" src="{@value}" />
								</a>
								<a href="#" data-action="removeThumb" class="link-danger position-absolute btn top-0 start-100 translate-middle p-1"><i class="fa-solid fa-circle-xmark"></i></button>
							</div>
							{{{ end }}}
							<a class="btn btn-ghost d-inline-block p-0" href="#" data-action="uploadThumb">
								<div class="d-flex align-items-center justify-content-center" style="width: 3.33rem; max-width: 5.33rem; height: 3.33rem;">
									<i class="fa-solid fa-upload"></i>
								</div>
							</a>
						</div>
					</div>
					{{{ end }}}
				</div>
			</div>
		</div>
		{{{ end }}}
	</div>

	<!-- IMPORT partials/paginator.tpl -->
</div>