<div class="row">
	<div class="col-lg-9">
		<div class="row">
			<div class="col-sm-6 text-center">
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="not-found" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small>
						<strong>[[admin/advanced/errors:figure-x, 1]]</strong> &ndash; 
						[[admin/advanced/errors:error-events-per-day, [[admin/advanced/errors:error.404]]]]
					</small></div>
				</div>
			</div>
			<div class="col-sm-6 text-center">
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="toobusy" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small>
						<strong>[[admin/advanced/errors:figure-x, 2]]</strong> &ndash; 
						[[admin/advanced/errors:error-events-per-day, [[admin/advanced/errors:error.503]]]]
					</small></div>
				</div>
			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/advanced/errors:manage-error-log]]</div>
			<div class="panel-body">
				<div class="btn-group-vertical btn-block" role="group">
					<a class="btn btn-info" target="_top" href="{config.relative_path}/admin/advanced/errors/export">
						<i class="fa fa-download"></i> [[admin/advanced/errors:export-error-log]]
					</a>
					<button class="btn btn-danger" data-action="clear">
						<i class="fa fa-trash"></i> [[admin/advanced/errors:clear-error-log]]
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<div class="row">
	<div class="col-xs-12">
		<div class="panel panel-default">
			<div class="panel-heading">
				<i class="fa fa-exclamation-triangle"></i> [[admin/advanced/errors:error.404]]
			</div>
			<div class="panel-body">
				<table class="table table-striped">
					<thead>
						<th>[[admin/advanced/errors:route]]</th>
						<th>[[admin/advanced/errors:count]]</th>
					</thead>
					<tbody>
						<!-- BEGIN not-found -->
						<tr>
							<td>{../value}</td>
							<td>{../score}</td>
						</tr>
						<!-- END not-found -->
						<!-- IF !not-found.length -->
						<tr>
							<td colspan="2">
								<div class="alert alert-success">
									[[admin/advanced/errors:no-routes-not-found]]
								</div>
							</td>
						</tr>
						<!-- ENDIF !not-found.length -->
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>