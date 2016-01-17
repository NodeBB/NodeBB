<div class="row dashboard">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">Forum Traffic</div>
			<div class="panel-body">
				<div class="graph-container">
					<ul class="graph-legend">
						<li><div class="page-views"></div><span>Page Views</span></li>
						<li><div class="unique-visitors"></div><span>Unique Visitors</span></li>
					</ul>
					<canvas id="analytics-traffic" width="100%" height="400"></canvas>
				</div>
				<hr/>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsLastMonth"></strong></div>
					<div><a href="#" data-action="updateGraph" data-units="days" data-until="last-month">Page views Last Month</a></div>
				</div>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsThisMonth"></strong></div>
					<div><a href="#" data-action="updateGraph" data-units="days">Page views This Month</a></div>
				</div>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsPastDay"></strong></div>
					<div><a href="#" data-action="updateGraph" data-units="hours">Page views in last 24 hours</a></div>
				</div>
			</div>
		</div>

		<div class="row">
			<!-- BEGIN stats -->
			<div class="col-lg-6">
				<div class="panel panel-default">
					<div class="panel-heading">{stats.name}</div>
					<div class="panel-body">
						<div id="unique-visitors">
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.day}</span>
								<div>Day</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.week}</span>
								<div>Week</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.month}</span>
								<div>Month</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.alltime}</span>
								<div>All Time</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<!-- END stats -->

			<div class="col-lg-6">
				<div class="panel panel-default">
					<div class="panel-heading">Updates</div>
					<div class="panel-body">
						<div class="alert alert-info version-check">
							<p>You are running <strong>NodeBB v<span id="version">{version}</span></strong>.</p>
						</div>
						<p>
							Always make sure that your NodeBB is up to date for the latest security patches and bug fixes.
						</p>
					</div>
				</div>
			</div>

			<div class="col-lg-6">
				<div class="panel panel-default">
					<div class="panel-heading">Notices</div>
					<div class="panel-body">
					<!-- BEGIN notices -->
						<div>
							<!-- IF notices.done -->
							<i class="fa fa-fw fa-check text-success"></i> {notices.doneText}
							<!-- ELSE -->
							<!-- IF notices.link --><a href="{notices.link}" data-toggle="tooltip" title="{notices.tooltip}"><!-- ENDIF notices.link -->
							<i class="fa fa-fw fa-times text-danger"></i> {notices.notDoneText}
							<!-- IF notices.link --></a><!-- ENDIF notices.link -->
							<!-- ENDIF notices.done -->
						</div>
					<!-- END notices -->
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">System Control</div>
			<div class="panel-body text-center">
				<p>
					<button class="btn btn-warning reload" data-placement="bottom" data-toggle="tooltip" title="Reload NodeBB to activate new plugins">Reload</button>
					<button class="btn btn-danger restart" data-placement="bottom" data-toggle="tooltip" title="Restarting NodeBB will drop all existing connections for a few seconds">Restart</button>
				</p>
				<p>
					<a href="{config.relative_path}/admin/settings/advanced" class="btn btn-info" data-placement="bottom" data-toggle="tooltip" title="Click here to set up maintenance mode for NodeBB">Maintenance Mode</a>
				</p>

				<hr />
				<span id="toggle-realtime">Realtime Chart Updates <strong>OFF</strong> <i class="fa fa fa-toggle-off pointer"></i></span>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Anonymous vs Registered Users</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-up">
					<ul class="graph-legend">
						<li><div class="anonymous"></div><span>Anonymous</span></li>
						<li><div class="registered"></div><span>Registered</span></li>
					</ul>
					<canvas id="analytics-registered"></canvas>
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">User Presence</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-up">
					<ul class="graph-legend">
						<li><div class="on-categories"></div><span>On categories list</span></li>
						<li><div class="reading-posts"></div><span>Reading posts</span></li>
						<li><div class="browsing-topics"></div><span>Browsing topics</span></li>
						<li><div class="recent"></div><span>Recent</span></li>
						<li><div class="unread"></div><span>Unread</span></li>
					</ul>
					<canvas id="analytics-presence"></canvas>
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">High Presence Topics</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-down">
					<canvas id="analytics-topics"></canvas>
					<ul class="graph-legend" id="topics-legend"></ul>
				</div>
			</div>
		</div>



		<div class="panel panel-default">
			<div class="panel-heading">Active Users</div>
			<div class="panel-body">
				<div id="active-users"></div>
			</div>
		</div>
	</div>
</div>