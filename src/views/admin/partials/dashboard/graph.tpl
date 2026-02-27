<div class="card shadow-none mb-3" id="analytics-panel">
	<div class="card-header">
		<div class="d-flex justify-content-between align-items-center">
			{graphTitle}

			<div class="d-flex gap-1 align-items-center">
				<select data-action="updateGraph" class="form-select form-select-sm">
					<option value="1">[[admin/dashboard:page-views-last-day]]</option>
					<option value="7">[[admin/dashboard:page-views-seven]]</option>
					<option value="30">[[admin/dashboard:page-views-thirty]]</option>
					<option value="custom">[[admin/dashboard:page-views-custom]]</option>
					<option value="range" class="hidden">[[admin/dashboard:page-views-custom]]</option>
				</select>
				<a class="btn btn-sm btn-light lh-sm" target="_blank" id="view-as-json" href="{config.relative_path}/api/v3/admin/analytics/{set}?type=hourly" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/dashboard:view-as-json]]"><i class="fa fa-fw fa-xs fa-terminal text-primary"></i></a>
				<a class="btn btn-sm btn-light lh-sm" id="expand-analytics" href="#" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/dashboard:expand-analytics]]"><i class="fa fa-fw fa-xs fa-expand text-primary"></i></a>
			</div>
		</div>
	</div>
	<div class="card-body p-0">
		<div class="graph-container position-relative" id="analytics-traffic-container" style="width: 100%; {{{ if template.admin/dashboard }}}min-height: 300px;{{{ end }}}">
			<canvas id="analytics-traffic"></canvas>
		</div>
	</div>
</div>