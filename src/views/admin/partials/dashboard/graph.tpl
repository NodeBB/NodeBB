<div class="panel panel-default" id="analytics-panel">
	<div class="panel-heading">
		[[admin/dashboard:forum-traffic]]
		<div class="pull-right">
			<a id="view-as-json" href="{config.relative_path}/api/v3/admin/analytics/{set}?type=hourly"><i class="fa fa-terminal"></i></a>
			<i class="fa fa-expand"></i>
		</div>
	</div>
	<div class="panel-body">
		<div class="graph-container" id="analytics-traffic-container">
			<canvas id="analytics-traffic" width="100%" height="400"></canvas>
		</div>
		<hr/>
		<div class="row">
			<div class="col-sm-3 hidden-xs text-center pageview-stats">
				<div><strong id="pageViewsThirty">{{{ if summary.month }}}{./summary.month}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph" data-action="updateGraph" data-units="days" data-amount="30">[[admin/dashboard:page-views-thirty]]</a></div>
			</div>
			<div class="col-sm-3 text-center pageview-stats">
				<div><strong id="pageViewsSeven">{{{ if summary.week }}}{./summary.week}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph" data-action="updateGraph" data-units="days" data-amount="7">[[admin/dashboard:page-views-seven]]</a></div>
			</div>
			<div class="col-sm-3 hidden-xs text-center pageview-stats">
				<div><strong id="pageViewsPastDay">{{{ if summary.day }}}{./summary.day}{{{ else }}}0{{{ end }}}</strong></div>
				<div><a href="#" class="updatePageviewsGraph active" data-action="updateGraph" data-units="hours">[[admin/dashboard:page-views-last-day]]</a></div>
			</div>
			<div class="col-sm-3 text-center pageview-stats">
				<div><strong><i class="fa fa-clock-o"></i></strong></div>
				<div><a href="#" class="updatePageviewsGraph" data-action="updateGraph" data-units="custom">[[admin/dashboard:page-views-custom]]</a></div>
			</div>
		</div>
	</div>
</div>