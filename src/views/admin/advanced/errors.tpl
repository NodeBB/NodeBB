<div class="row">
	<div class="col-lg-9">
		<div class="row">
			<div class="col-sm-6 text-center">
				<div class="card">
					<div class="card-block">
						<div><canvas id="not-found" height="250"></canvas></div>
					</div>
					<div class="card-footer"><small><strong>Figure 1</strong> &ndash; <code>404 Not Found</code> events per day</small></div>
				</div>
			</div>
			<div class="col-sm-6 text-center">
				<div class="card">
					<div class="card-block">
						<div><canvas id="toobusy" height="250"></canvas></div>
					</div>
					<div class="card-footer"><small><strong>Figure 2</strong> &ndash; <code>503 Service Unavailable</code> events per day</small></div>
				</div>
			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="card">
			<div class="card-header">Manage Error Log</div>
			<div class="card-block">
				<div class="btn-group-vertical btn-block" role="group">
					<a class="btn btn-info" target="_top" href="{config.relative_path}/admin/advanced/errors/export"><i class="fa fa-download"></i> Export Error Log (CSV)</a>
					<button class="btn btn-danger" data-action="clear"><i class="fa fa-trash"></i> Clear Error Log</button>
				</div>
			</div>
		</div>
	</div>
</div>

<div class="row">
	<div class="col-xs-12">
		<div class="card">
			<div class="card-header"><i class="fa fa-exclamation-triangle"></i> 404 Not Found</div>
			<div class="card-block">
				<table class="table table-striped">
					<thead>
						<th>Route</th>
						<th>Count</th>
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
									Hooray! There are no routes that were not found.
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