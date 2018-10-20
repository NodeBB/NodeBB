<div class="row">
	<div class="col-xs-12">
		<div class="post-queue panel panel-primary preventSlideout">
			<div class="panel-heading">
				[[admin/manage/post-queue:post-queue]]
			</div>

			<!-- IF !posts.length -->
			<p class="panel-body">
				[[admin/manage/post-queue:description, {config.relative_path}/admin/settings/post#posting-restrictions]]
			</p>
			<!-- ENDIF !posts.length -->

			<div class="table-responsive">
				<table class="table table-striped posts-list">
					<thead>
						<tr>
							<th>[[admin/manage/post-queue:user]]</th>
							<th>[[admin/manage/post-queue:category]]</th>
							<th>[[admin/manage/post-queue:title]]</th>
							<th>[[admin/manage/post-queue:content]] <i class="fa fa-info-circle" data-toggle="tooltip" title="[[admin/manage/post-queue:content-editable]]"></i></th>
							<th>[[admin/manage/post-queue:posted]]</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<!-- BEGIN posts -->
						<tr data-id="{posts.id}">
							<td class="col-md-1">
								<!-- IF posts.user.userslug -->
								<a href="/uid/{posts.user.uid}">{posts.user.username}</a>
								<!-- ELSE -->
								{posts.user.username}
								<!-- ENDIF posts.user.userslug -->
							</td>
							<td class="col-md-2">
								<a href="{config.relative_path}/category/{posts.category.slug}"><!-- IF posts.categiry.icon --><span class="fa-stack"><i style="color: {posts.category.bgColor};" class="fa fa-circle fa-stack-2x"></i><i style="color: {posts.category.color};" class="fa fa-stack-1x fa-fw {posts.category.icon}"></i></span><!-- ENDIF posts.category.icon --> {posts.category.name}</a>
							</td>
							<td class="col-md-2">
								<!-- IF posts.data.tid -->
								<a href="{config.relative_path}/topic/{posts.data.tid}">[[admin/manage/post-queue:reply-to, {posts.topic.title}]]</a>
								<!-- ENDIF posts.data.tid -->
								{posts.data.title}
							</td>
							<td class="col-md-5 post-content">{posts.data.content}</td>
							<td class="col-md-5 post-content-editable hidden">
								<textarea>{posts.data.rawContent}</textarea>
							</td>
							<td class="col-md-1">
								<span class="timeago" title={posts.data.timestampISO}></span>
							</td>
							<td class="col-md-1">
								<div class="btn-group pull-right">
									<button class="btn btn-success btn-xs" data-action="accept"><i class="fa fa-check"></i></button>
									<button class="btn btn-danger btn-xs" data-action="delete"><i class="fa fa-times"></i></button>
								</div>
							</td>
						</tr>
						<!-- END posts -->
					</tbody>
				</table>
			</div>

			<!-- IMPORT partials/paginator.tpl -->
		</div>
	</div>
</div>