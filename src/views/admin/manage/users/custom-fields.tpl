<div class="manage-users d-flex flex-column gap-2 px-lg-4 h-100">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/user-custom-fields:title]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="new" class="btn btn-light btn-sm text-nowrap" type="button">
				<i class="fa fa-fw fa-plus"></i> [[admin/manage/user-custom-fields:create-field]]
			</button>
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div class="row flex-grow-1">
		<div class="col-lg-12 d-flex flex-column gap-2">
			<div class="table-responsive flex-grow-1">
				<table class="table text-sm">
					<thead>
						<tr>
							<th></th>
							<th class="text-muted">[[admin/manage/user-custom-fields:key]]</th>
							<th class="text-muted">[[admin/manage/user-custom-fields:name]]</th>
							<th class="text-muted">[[admin/manage/user-custom-fields:type]]</th>
							<th class="text-muted">[[admin/manage/user-custom-fields:visibility]]</th>
							<th class="text-muted text-end">[[admin/manage/user-custom-fields:min-rep]]</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{{{ each fields }}}
						<tr data-key="{./key}" data-name="{./name}" data-icon="{./icon}" data-type="{./type}" data-min-rep="{./min:rep}" data-select-options="{./select-options}" data-visibility="{./visibility}" class="align-middle">
							<td style="width: 32px;">
								<a href="#" component="sort/handle" class="btn btn-light btn-sm d-none d-md-block ui-sortable-handle" style="cursor:grab;"><i class="fa fa-arrows-up-down text-muted"></i></a>
							</td>
							<td class="text-nowrap">{./key}</td>
							<td class="text-nowrap">{{{ if ./icon }}}<i class="text-muted {./icon}"></i> {{{ end }}}{./name}</td>
							<td>
								{./type}
								{{{ if ((./type == "select") || (./type == "select-multi")) }}}
								<div class="text-muted">
								({./selectOptionsFormatted})
								</div>
								{{{ end }}}
							</td>
							<td>
								{./visibility}
							</td>
							<td class="text-end">
								{./min:rep}
							</td>
							<td>
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