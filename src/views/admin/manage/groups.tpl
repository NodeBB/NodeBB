<div class="px-lg-4">

	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/groups:manage-groups]]</h4>
		</div>
		<div class="d-flex gap-1">
			<div class="input-group">
				<input type="text" class="form-control form-control-sm" placeholder="[[admin/manage/groups:search-placeholder]]" id="group-search">
				<span class="input-group-text search-button"><i class="fa fa-search"></i></span>
			</div>

			<button id="create" class="btn btn-primary btn-sm btn btn-primary btn-sm fw-semibold ff-secondary text-center text-nowrap">[[admin/manage/groups:add-group]]</button>
		</div>
	</div>

	<div class="row groups">
		<div class="col-12">
			<div class="table-responsive">
				<table class="table groups-list">
					<thead>
						<tr>
							<th>[[admin/manage/groups:name]]</th>
							<th>[[admin/manage/groups:badge]]</th>
							<th>[[admin/manage/groups:properties]]</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{{{ each groups }}}
						<tr data-groupname="{./displayName}" data-name-encoded="{./nameEncoded}">
							<td>
								<a href="{config.relative_path}/admin/manage/groups/{./slug}">{./displayName}</a> ({./memberCount})
								<p class="description text-xs text-muted m-0">{./description}</p>
							</td>
							<td>
								<span class="badge" style="color:{./textColor}; background-color: {./labelColor};">{{{ if ./icon }}}<i class="fa {./icon}"></i> {{{ end }}}{./userTitle}</span>
							</td>
							<td>
								{{{ if ./system }}}
								<span class="badge bg-danger">[[admin/manage/groups:system]]</span>
								{{{ end }}}
								{{{ if ./private }}}
								<span class="badge bg-primary">[[admin/manage/groups:private]]</span>
								{{{ end }}}
								{{{ if ./hidden }}}
								<span class="badge bg-secondary">[[admin/manage/groups:hidden]]</span>
								{{{ end }}}
							</td>

							<td>
								<div class="d-flex justify-content-end gap-1">
									<a href="{config.relative_path}/groups/{groups.slug}" class="btn btn-light btn-sm">[[admin/admin:view]]</a>

									<a href="{config.relative_path}/admin/manage/groups/{groups.slug}" class="btn btn-light btn-sm">[[admin/admin:edit]]</a>


									<button class="btn btn-light btn-sm {{{ if groups.system }}} disabled {{{ end }}}" data-action="delete"><i class="fa fa-trash text-danger"></i></button>
								</div>
							</td>
						</tr>
						{{{ end }}}
					</tbody>
				</table>
			</div>

			<!-- IMPORT admin/partials/paginator.tpl -->
		</div>
	</div>
</div>

