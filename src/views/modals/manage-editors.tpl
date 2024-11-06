<div class="card tool-modal shadow">
	<h5 class="card-header">[[topic:thread-tools.manage-editors]]</h5>
	<div class="card-body">
		<p>
			[[topic:manage-editors-instruction]]
		</p>
		<div class="mb-3">
			<label class="form-label" for="username"><strong>[[user:username]]</strong></label>
			<div class="input-group">
				<input id="username" type="text" class="form-control" name="username">
				<span class="input-group-text" type="button">
					<i class="fa fa-search"></i>
				</span>
			</div>
		</div>
		<div class="d-flex flex-wrap" component="topic/editors">
			{{{ each editors }}}
			<div class="badge text-bg-light m-1 p-1 border d-inline-flex gap-1 align-items-center" data-uid="{./uid}">
				{buildAvatar(@value, "24px", true)}
				<a href="{config.relative_path}/user/{./userslug}">{./username}</a>
				<button class="btn btn-ghost btn-sm p-0 remove-user-icon">
					<i class="fa fa-fw fa-times"></i>
				</button>
			</div>
			{{{ end }}}
		</div>
	</div>
	<div class="card-footer text-end">
		<button class="btn btn-link btn-sm" id="manage_editors_cancel">[[global:buttons.close]]</button>
		<button class="btn btn-primary btn-sm" id="manage_editors_commit">[[global:save]]</button>
	</div>
</div>
