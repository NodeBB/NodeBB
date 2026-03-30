<div class="col-12 col-md-4 px-0 px-md-3 options acp-sidebar">
	<div class="p-2 d-flex flex-column text-bg-light border rounded-1 gap-1">
		<a href="{config.relative_path}/admin/manage/categories" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center"><i class="fa fa-fw fa-chevron-left text-primary"></i> [[admin/manage/categories:back-to-categories]]</a>

		<hr class="my-1"/>

		{{{ if (template.name == "admin/manage/category") }}}
		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center copy-settings">
			<i class="fa fa-fw fa-files-o text-primary"></i> [[admin/manage/categories:copy-settings]]
		</button>
		{{{ else }}}
		<a href="{config.relative_path}/admin/manage/categories/{(cid || category.cid)}" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
			<i class="fa fa-fw fa-edit text-primary"></i> [[admin/manage/categories:edit]]
		</a>
		{{{ end }}}

		<a class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" href="{config.relative_path}/admin/manage/categories/{(cid || category.cid)}/analytics"><i class="fa fa-fw fa-chart-simple text-primary"></i> [[admin/manage/categories:analytics]]</a>

		<a href="{config.relative_path}/admin/manage/privileges/{(cid || category.cid)}" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
			<i class="fa fa-fw fa-lock text-primary"></i> [[admin/manage/categories:privileges]]
		</a>

		<a class="btn btn-ghost btn-sm d-flex gap-2 align-items-center" href="{config.relative_path}/admin/manage/categories/{(cid || category.cid)}/federation">
			<i class="fa fa-fw fa-globe text-primary"></i> [[admin/manage/categories:federation]]
		</a>

		<a href="{config.relative_path}/category/{(cid || category.cid)}" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
			<i class="fa fa-fw fa-eye text-primary"></i> [[admin/manage/categories:view-category]]
		</a>

		{{{ if (template.name == "admin/manage/category") }}}
		<hr class="my-1"/>

		<button data-action="toggle" data-disabled="{(disabled || category.disabled)}" class="btn btn-ghost btn-sm d-flex gap-2 align-items-center">
			{{{ if (disabled || category.disabled) }}}
			<i class="fa fa-fw fa-check text-success"></i>
			<span class="label">[[admin/manage/categories:enable]]</span>
			{{{ else }}}
			<i class="fa fa-fw fa-ban text-danger"></i>
			<span class="label">[[admin/manage/categories:disable]]</span>
			{{{ end }}}
		</button>

		<button class="btn btn-ghost btn-sm d-flex gap-2 align-items-center purge">
			<i class="fa fa-fw fa-trash text-danger"></i> [[admin/manage/categories:purge]]
		</button>
		{{{ end }}}
	</div>
</div>