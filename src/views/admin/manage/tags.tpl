<div class="tags d-flex flex-column gap-2 px-lg-4">

	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/tags:manage-tags]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1 flex-wrap">
			<div class="input-group flex-nowrap w-auto">
				<input class="form-control form-control-sm w-auto" type="text" id="tag-search" placeholder="[[admin/manage/tags:search]]"/>
				<span class="input-group-text"><i class="fa fa-search"></i></span>
			</div>


			<button class="btn btn-light btn-sm text-nowrap" id="rename"><i class="fa fa-pencil text-primary"></i> [[admin/manage/tags:rename]]</button>
			<button class="btn btn-light btn-sm text-nowrap" id="deleteSelected"><i class="fa fa-trash text-danger"></i> [[admin/manage/tags:delete]]</button>
			<button class="btn btn-primary btn-sm text-nowrap" id="create">[[admin/manage/tags:add-tag]]</button>
		</div>
	</div>

	<div class="tags">
		<div class="">
			<div class="tag-management">
				<div class="">
					<div class="alert alert-light text-sm">
						[[admin/manage/tags:description]]
					</div>

					{{{ if !tags.length }}}
					[[admin/manage/tags:none]]
					{{{ end }}}

					<div class="tag-list">
						{{{ each tags }}}
						<div class="tag-row p-2 me-3 mb-1" data-tag="{tags.valueEscaped}">
							<div>
								<button disabled class="rounded-3 btn btn-light border position-relative">
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
</div>