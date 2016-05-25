<div class="row">
	<div class="col-lg-9">
		<div class="row">
			<div class="col-sm-6 text-center">
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="not-found" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small><strong>Figure 1</strong> &ndash; <code>404 Not Found</code> events per day</small></div>
				</div>
			</div>
			<div class="col-sm-6 text-center">
				<div class="panel panel-default">
					<div class="panel-body">
						<div><canvas id="toobusy" height="250"></canvas></div>
					</div>
					<div class="panel-footer"><small><strong>Figure 2</strong> &ndash; <code>503 Service Unavailable</code> events per day</small></div>
				</div>
			</div>
		</div>
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-exclamation-triangle"></i> 404 Not Found</div>
			<div class="panel-body">
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
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Manage Error Log</div>
			<div class="panel-body">
				<div class="btn-group-vertical btn-block" role="group">
					<button class="btn btn-info" data-action="export"><i class="fa fa-download"></i> Export Error Log (CSV)</button>
					<button class="btn btn-danger" data-action="clear"><i class="fa fa-trash"></i> Clear Error Log</button>
				</div>
			</div>
		</div>
	</div>
</div>
