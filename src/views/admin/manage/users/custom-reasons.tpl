<div class="manage-users d-flex flex-column gap-2 px-lg-4 h-100">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/custom-reasons:title]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="new" class="btn btn-light btn-sm text-nowrap" type="button">
				<i class="fa fa-fw fa-plus"></i> [[admin/manage/custom-reasons:create-reason]]
			</button>
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<p class="text-secondary">[[admin/manage/custom-reasons:reasons-help]]</p>

	<div class="row flex-grow-1">
		<div class="col-lg-12 d-flex flex-column gap-2">
			<div class="table-responsive flex-grow-1">
				<table class="table text-sm">
					<thead>
						<tr>
							<th></th>
							<th class="text-muted">[[admin/manage/custom-reasons:reason-title]]</th>
							<th class="text-muted">[[admin/manage/custom-reasons:reason-type]]</th>
							<th class="text-muted">[[admin/manage/custom-reasons:reason-body]]</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{{{ each reasons }}}
						<tr data-key="{./key}" data-title="{./title}" data-type="{./type}" data-body="{./body}">
							<td class="" style="width: 32px;">
								<a href="#" component="sort/handle" class="btn btn-light btn-sm d-none d-md-block ui-sortable-handle" style="cursor:grab;"><i class="fa fa-arrows-up-down text-muted"></i></a>
							</td>
							<td class="text-nowrap">{./title}</td>
							<td class="text-nowrap">{{{ if ./type }}}[[admin/manage/custom-reasons:reason-{{./type}}]]{{{ else }}}[[admin/manage/custom-reasons:reason-all]]{{{ end }}}</td>
							<td class="">{./parsedBody}</td>
							<td class="">
								<div class="d-flex justify-content-end gap-1">
									<button data-action="edit" data-key="{./key}" class="btn btn-light btn-sm">[[admin/admin:edit]]</button>
									<button data-action="delete" data-key="{./key}" class="btn btn-light btn-sm"><i class="fa fa-trash text-danger"></i></button>
								</div>
							</td>
						</tr>
						{{{ end }}}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>