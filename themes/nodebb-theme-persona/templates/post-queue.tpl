<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="btn-toolbar">
	<!-- IMPORT partials/category-filter-right.tpl -->

	{{{ if !singlePost }}}
	<div class="btn-group pull-right bottom-sheet" component="post-queue/bulk-actions">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" autocomplete="off" aria-haspopup="true" aria-expanded="false">
			<i class="fa fa-clone"></i> [[post-queue:bulk-actions]] <span class="caret"></span>
		</button>
		<ul class="dropdown-menu dropdown-menu-right">
			<li><a href="#" data-action="accept-all">[[post-queue:accept-all]]</a></li>
			<li><a href="#" data-action="accept-selected">[[post-queue:accept-selected]]</a></li>
			<li class="divider"></li>
			<li><a href="#" data-action="reject-all">[[post-queue:reject-all]]</a></li>
			<li><a href="#" data-action="reject-selected">[[post-queue:reject-selected]]</a></li>
		</ul>
	</div>
	{{{ end }}}
</div>
<hr/>
<div class="row">
	<div class="col-xs-12">
		<div class="post-queue preventSlideout posts-list">
			{{{ if !posts.length }}}
			{{{ if isAdmin }}}
			<p class="panel-body">
				[[post-queue:description, {config.relative_path}/admin/settings/post#post-queue]]
			</p>
			{{{ end }}}
			{{{ end }}}

			{{{ each posts }}}
			<div class="panel panel-default" data-id="{posts.id}">
				<div class="panel-heading">
					{{{ if !singlePost }}}
					<input type="checkbox" autocomplete="off" />
					{{{ end }}}
					<strong>{{{ if posts.data.tid }}}[[post-queue:reply]]{{{ else }}}[[post-queue:topic]]{{{ end }}}</strong>
					<span class="timeago pull-right" title={posts.data.timestampISO}></span>
				</div>
				<div class="panel-body">

					<div class="row">
						<div class="col-lg-2 col-xs-12">
							<strong>[[post-queue:user]]</strong>
							<div>
								{{{ if posts.user.userslug}}}
								<a href="{config.relative_path}/uid/{posts.user.uid}">{buildAvatar(posts.user, "24", true, "not-responsive")} {posts.user.username}</a>
								{{{ else }}}
								{posts.user.username}
								{{{ end }}}
							</div>
						</div>
						<div class="col-lg-3 col-xs-12">
							<strong>[[post-queue:category]]{{{ if posts.data.cid}}} <i class="fa fa-fw fa-edit" data-toggle="tooltip" title="[[post-queue:category-editable]]"></i>{{{ end }}}</strong>
							<div class="topic-category" {{{if posts.data.cid}}}data-editable="editable"{{{end}}}">
								<a href="{config.relative_path}/category/{posts.category.slug}"><!-- IF posts.category.icon --><span class="fa-stack"><i style="color: {posts.category.bgColor};" class="fa fa-circle fa-stack-2x"></i><i style="color: {posts.category.color};" class="fa fa-stack-1x fa-fw {posts.category.icon}"></i></span><!-- ENDIF posts.category.icon --> {posts.category.name}</a>
							</div>
						</div>
						<div class="col-lg-7 col-xs-12">
							<strong>{{{ if posts.data.tid }}}[[post-queue:topic]]{{{ else }}}[[post-queue:title]] <i class="fa fa-fw fa-edit" data-toggle="tooltip" title="[[post-queue:title-editable]]"></i>{{{ end }}}</strong>
							<div class="topic-title">
								{{{ if posts.data.tid }}}
								<a href="{config.relative_path}/topic/{posts.data.tid}">{posts.topic.title}</a>
								{{{ end }}}
								<span class="title-text">{posts.data.title}</span>
							</div>
							{{{if !posts.data.tid}}}
							<div class="topic-title-editable hidden">
								<input class="form-control" type="text" value="{posts.data.title}"/>
							</div>
							{{{end}}}
						</div>
					</div>
					<hr/>
					<div>
						<strong>[[post-queue:content]] <i class="fa fa-fw fa-edit" data-toggle="tooltip" title="[[post-queue:content-editable]]"></i></strong>
						<div class="post-content">{posts.data.content}</div>
						<div class="post-content-editable hidden">
							<textarea class="form-control">{posts.data.rawContent}</textarea>
						</div>
					</div>
				</div>
				<div class="panel-footer text-right">
					<div>
						{{{ if canAccept }}}
						<button class="btn btn-danger btn-xs" data-action="reject"><i class="fa fa-fw fa-times"></i> [[post-queue:reject]]</button>
						<button class="btn btn-info btn-xs" data-action="notify"><i class="fa fa-fw fa-bell-o"></i> [[post-queue:notify]]</button>
						<button class="btn btn-success btn-xs" data-action="accept"><i class="fa fa-fw fa-check"></i> [[post-queue:accept]] </button>
						{{{ else }}}
						<button class="btn btn-danger btn-xs" data-action="reject"><i class="fa fa-fw fa-times"></i> [[post-queue:remove]]</button>
						{{{ end }}}
					</div>
				</div>
			</div>
			{{{ end }}}
		</div>

		<!-- IMPORT partials/paginator.tpl -->
	</div>
</div>