<div component="groups/container" class="groups details flex-fill">
	<div class="cover position-absolute start-0 top-0" component="groups/cover" style="background-image: url({group.cover:url}?{config.cache-buster}); background-position: {group.cover:position};">
		<div class="container">
			{{{ if group.isOwner }}}
			<div class="controls text-center">
				<span class="upload p-2 m-2 rounded-1 text-bg-light opacity-75"><i class="fa fa-fw fa-upload"></i></span>
				<span class="resize p-2 m-2 rounded-1 text-bg-light opacity-75"><i class="fa fa-fw fa-arrows"></i></span>
				<span class="remove p-2 m-2 rounded-1 text-bg-light opacity-75"><i class="fa fa-fw fa-times"></i></span>
			</div>
			<a href="#" class="save btn btn-primary">[[groups:cover-save]] <i class="fa fa-fw fa-floppy-o"></i></a>
			<div class="indicator text-bg-primary">[[groups:cover-saving]] <i class="fa fa-fw fa-refresh fa-spin"></i></div>
			{{{ end }}}
		</div>
	</div>

	<div class="d-flex flex-column flex-md-row justify-content-md-between pb-4 mb-4 mt-2 border-bottom gap-3">
		<div class="d-flex flex-column mt-1 gap-2">
			<div class="d-flex flex-column flex-md-row align-items-md-center gap-2">
				<h3 class="mb-0 text-capitalize">{generateGroupDisplayName(group)}</h3>
				<div>
					{{{ if group.private }}}<span class="badge text-bg-light border border-1">[[groups:details.private]]</span>{{{ end }}}
					{{{ if group.hidden }}}<span class="badge text-bg-light border border-1">[[groups:details.hidden]]</span>{{{ end }}}
				</div>
			</div>
			<div>
				{{txEscape(group.descriptionParsed)}}
			</div>
		</div>
		<div class="d-flex gap-2 align-items-start">
			{{{ if loggedIn }}}
			{{membershipBtn(group)}}
			{{{ end }}}
			{{{ if isAdmin }}}
			<a href="{config.relative_path}/admin/manage/groups/{group.slug}" target="_blank" class="btn btn-light text-nowrap"><i class="fa fa-gear"></i> [[user:edit]]</a>
			{{{ end }}}
		</div>
	</div>

	<div class="d-flex flex-column flex-md-row">
		<div data-widget-area="left">
			{{{each widgets.left}}}
			{{widgets.left.html}}
			{{{end}}}
		</div>
		<!-- IMPORT partials/groups/sidebar-left.tpl -->

		<div class="flex-grow-1 ps-md-2 ps-lg-5" style="min-width:0;">
			<div class="tab-content">
				<div class="tab-pane fade show active" id="groups-posts" role="tabpanel">
					<h3 class="fw-semibold fs-5 mb-0">[[global:posts]]</h3>
					{{{ if !posts.length }}}
					<div class="alert alert-info my-2">[[groups:details.has-no-posts]]</div>
					{{{ end }}}
					<!-- IMPORT partials/posts_list.tpl -->
				</div>
				<div class="tab-pane fade" id="groups-members" role="tabpanel">
					<h3 class="fw-semibold fs-5 mb-3">[[groups:details.members]]</h3>

					<!-- IMPORT partials/groups/memberlist.tpl -->
				</div>
				{{{ if group.isOwner }}}
				<div class="tab-pane fade" id="groups-pending" role="tabpanel">
					<h3 class="fw-semibold fs-5 mb-3">[[groups:details.pending]]</h3>
					<!-- IMPORT partials/groups/pending.tpl -->
				</div>

				<div class="tab-pane fade" id="groups-invited" role="tabpanel">
					<h3 class="fw-semibold fs-5 mb-3">[[groups:details.invited]]</h3>
					<!-- IMPORT partials/groups/invited.tpl -->
				</div>

				<div class="tab-pane fade" id="groups-admin" role="tabpanel">
					<div class="d-flex align-items-center gap-1 justify-content-between mb-3 flex-wrap">
						<h3 class="fw-semibold fs-5">[[groups:details.owner-options]]</h3>
						<div class="d-flex justify-content-end gap-2">
							<button class="btn btn-link btn-sm text-danger border-danger" type="button" data-action="delete">[[groups:details.delete-group]]</button>
							<button class="btn btn-primary btn-sm" type="button" data-action="update">[[global:save-changes]]</button>
						</div>
					</div>
					<!-- IMPORT partials/groups/admin.tpl -->
				</div>
				{{{ end }}}
			</div>
		</div>

		<div data-widget-area="right">
			{{{each widgets.right}}}
			{{widgets.right.html}}
			{{{end}}}
		</div>
	</div>
</div>
