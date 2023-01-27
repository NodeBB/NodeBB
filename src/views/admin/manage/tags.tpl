<div class="tags row">
	<div class="col-lg-9">
		<div class="card tag-management">
			<div class="card-body">
				<div class="alert alert-info">
					<p>[[admin/manage/tags:description]]</p>
				</div>

				{{{ if !tags.length }}}
				[[admin/manage/tags:none]]
				{{{ end }}}

				<div class="tag-list">
					{{{ each tags }}}
					<div class="tag-row" data-tag="{tags.valueEscaped}">
						<div>
							<button disabled class="rounded-3 btn btn-light">
								{tags.valueEscaped}
								<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary">{tags.score} <span class="visually-hidden">[[tags:tags]]</span>
							</button>
						</div>
					</div>
					{{{ end }}}
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="card">
			<div class="card-body">
				<div class="d-grid gap-2">
					<button class="btn btn-primary btn-block" id="create">[[admin/manage/tags:create]]</button>
					<button class="btn btn-primary btn-block" id="rename">[[admin/manage/tags:rename]]</button>
					<button class="btn btn-warning btn-block" id="deleteSelected">[[admin/manage/tags:delete]]</button>
				</div>
				<hr />
				<div class="d-grid gap-2">
					<a class="btn btn-outline-secondary" href="{config.relative_path}/admin/settings/tags">
						<i class="fa fa-external-link"></i>
						[[admin/manage/tags:settings]]
					</a>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-body">
				<div class="input-group">
					<input class="form-control" type="text" id="tag-search" placeholder="[[admin/manage/tags:search]]"/>
					<span class="input-group-text"><i class="fa fa-search"></i></span>
				</div>
			</div>
		</div>
	</div>

	<div class="modal fade" id="create-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h4 class="modal-title">[[admin/manage/tags:create]]</h4>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
				</div>
				<div class="modal-body">
					<form>
						<div class="mb-3">
							<label class="form-label" for="create-tag-name">[[admin/manage/tags:name]]</label>
							<input type="text" class="form-control" id="create-tag-name" placeholder="[[admin/manage/tags:name]]" />
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-primary" id="create-modal-go">[[admin/manage/tags:create]]</button>
				</div>
			</div>
		</div>
	</div>

	<div class="rename-modal hidden">
		<div class="form-group">
			<label class="form-label" for="value">[[admin/manage/tags:name]]</label>
			<input id="value" data-name="value" value="" class="form-control" />
		</div>
	</div>
</div>
