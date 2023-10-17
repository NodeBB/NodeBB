<div class="errors d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/advanced/errors:errors]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button class="btn btn-sm btn-light text-nowrap" data-action="clear">
				<i class="fa fa-trash text-danger"></i> [[admin/advanced/errors:clear-error-log]]
			</button>
			<a class="btn btn-sm btn-light text-nowrap" target="_top" href="{config.relative_path}/admin/advanced/errors/export">
				<i class="fa fa-download text-primary"></i> [[admin/advanced/errors:export-error-log]]
			</a>
		</div>
	</div>

	<div class="px-2">
		<div class="row">
			<div class="col-sm-6 text-center">
				<div class="card">
					<div class="card-body" >
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="not-found"></canvas>
						</div>
					</div>
					<div class="card-footer"><small>
						<strong>[[admin/advanced/errors:figure-x, 1]]</strong> &ndash;
						[[admin/advanced/errors:error-events-per-day, [[admin/advanced/errors:error.404]]]]
					</small></div>
				</div>
			</div>
			<div class="col-sm-6 text-center">
				<div class="card">
					<div class="card-body">
						<div class="position-relative" style="aspect-ratio: 2;">
							<canvas id="toobusy"></canvas>
						</div>
					</div>
					<div class="card-footer"><small>
						<strong>[[admin/advanced/errors:figure-x, 2]]</strong> &ndash;
						[[admin/advanced/errors:error-events-per-day, [[admin/advanced/errors:error.503]]]]
					</small></div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header">
				<i class="fa fa-exclamation-triangle"></i> [[admin/advanced/errors:error.404]]
			</div>
			<div class="card-body">
				<div class="table-responsive">
					<table class="table text-sm">
						<thead>
							<th>[[admin/advanced/errors:route]]</th>
							<th class="text-end">[[admin/advanced/errors:count]]</th>
						</thead>
						<tbody>
							{{{ each not-found }}}
							<tr>
								<td class="text-break">{./value}</td>
								<td class="text-end">{./score}</td>
							</tr>
							{{{ end }}}
							{{{ if !not-found.length }}}
							<tr>
								<td colspan="2">
									<div class="alert alert-success">
										[[admin/advanced/errors:no-routes-not-found]]
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
</div>