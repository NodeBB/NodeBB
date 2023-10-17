<div class="card mb-3" id="analytics-panel">
	<div class="card-header">
		<div class="d-flex justify-content-between">
			[[admin/dashboard:forum-traffic]]

			<div class="d-flex gap-1">
				<a class="btn btn-sm btn-light lh-sm" target="_blank" id="view-as-json" href="{config.relative_path}/api/v3/admin/analytics/{set}?type=hourly" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/dashboard:view-as-json]]"><i class="fa fa-fw fa-xs fa-terminal text-primary"></i></a>
				<a class="btn btn-sm btn-light lh-sm" id="expand-analytics" href="#" data-bs-toggle="tooltip" data-bs-placement="bottom" title="[[admin/dashboard:expand-analytics]]"><i class="fa fa-fw fa-xs fa-expand text-primary"></i></a>
			</div>
		</div>
	</div>
	<div class="card-body">
		<div class="graph-container position-relative" id="analytics-traffic-container" style="aspect-ratio: 2;">
			<canvas id="analytics-traffic" ></canvas>
		</div>
		<hr/>
		<div class="row">
			<div class="col-sm-3 hidden-xs text-center pageview-stats">
				<div><strong id="pageViewsThirty">{{{ if summary.month }}}{./summary.month}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph text-sm" data-action="updateGraph" data-units="days" data-amount="30">[[admin/dashboard:page-views-thirty]]</a></div>
			</div>
			<div class="col-sm-3 text-center pageview-stats">
				<div><strong id="pageViewsSeven">{{{ if summary.week }}}{./summary.week}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph text-sm" data-action="updateGraph" data-units="days" data-amount="7">[[admin/dashboard:page-views-seven]]</a></div>
			</div>
			<div class="col-sm-3 hidden-xs text-center pageview-stats">
				<div><strong id="pageViewsPastDay">{{{ if summary.day }}}{./summary.day}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph text-sm" data-action="updateGraph" data-units="hours" data-amount="24">[[admin/dashboard:page-views-last-day]]</a></div>
			</div>
			<div class="col-sm-3 text-center pageview-stats">
				<div><strong><i class="fa fa-clock-o"></i></strong></div>
				<div><a href="#" class="updatePageviewsGraph text-sm" data-action="updateGraph" data-units="custom">[[admin/dashboard:page-views-custom]]</a></div>
			</div>
		</div>
	</div>
</div>