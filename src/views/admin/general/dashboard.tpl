<div class="row dashboard">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"></div>
			<div class="panel-body">
				<div class="graph-container">
					<ul class="graph-legend">
						<li><div class="page-views"></div><span>[[admin:dashboard.page_views]]</span></li>
						<li><div class="unique-visitors"></div><span>[[admin:dashboard.unique_visitors]]</span></li>
					</ul>
					<canvas id="analytics-traffic" width="100%" height="400"></canvas>
				</div>
				<hr/>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsLastMonth"></strong></div>
					<div>[[admin:dashboard.page_views_last_month]]</div>
				</div>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsThisMonth"></strong></div>
					<div>[[admin:dashboard.page_views_this_month]]</div>
				</div>
				<div class="text-center pull-left monthly-pageviews">
					<div><strong id="pageViewsPastDay"></strong></div>
					<div>[[admin:dashboard.page_views_in_last_24_hours]]</div>
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
								<div>[[admin:dashboard.day]]</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.week}</span>
								<div>[[admin:dashboard.week]]</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.month}</span>
								<div>[[admin:dashboard.month]]</div>
							</div>
							<div class="text-center pull-left">
								<span class="formatted-number">{stats.alltime}</span>
								<div>[[admin:dashboard.all_time]]</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<!-- END stats -->

			<div class="col-lg-6">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin:dashboard.updates]]</div>
					<div class="panel-body">
						<div class="alert alert-info version-check">
							<p>[[admin:dashboard.running]] <strong>NodeBB v<span id="version">{version}</span></strong>.</p>
						</div>
						<p>
							[[admin:dashboard.update_notice]]
						</p>
					</div>
				</div>
			</div>

			<div class="col-lg-6">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin:dashboard.notices]]</div>
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
			<div class="panel-heading">[[admin:dashboard.system_control]]</div>
			<div class="panel-body text-center">
				<p>
					<button class="btn btn-warning reload" data-placement="bottom" data-toggle="tooltip" title="[[admin:dashboard.reload_tooltip]]">[[admin:dashboard.reload]]</button>
					<button class="btn btn-danger restart" data-placement="bottom" data-toggle="tooltip" title="[[admin:dashboard.restart_tooltip]]">[[admin:dashboard.restart]]</button>
				</p>
				<p>
					<a href="{config.relative_path}/admin/settings/advanced" class="btn btn-info" data-placement="bottom" data-toggle="tooltip" title="[[admin:dashboard.maintenance_mode_tooltip]]">[[admin:dashboard.maintenance_mode]]</a>
				</p>

				<hr />
				<span id="toggle-realtime">[[admin:dashboard.realtime_chart_updates]] <strong>OFF</strong> <i class="fa fa fa-toggle-off pointer"></i></span>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:dashboard.user]]</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-up">
					<ul class="graph-legend">
						<li><div class="anonymous"></div><span>[[admin:dashboard.anonymous]]</span></li>
						<li><div class="registered"></div><span>[[admin:dashboard.registered]]</span></li>
					</ul>
					<canvas id="analytics-registered"></canvas>
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:dashboard.user_presence]]</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-up">
					<ul class="graph-legend">
						<li><div class="on-categories"></div><span>[[admin:dashboard.on_categories_list]]</span></li>
						<li><div class="reading-posts"></div><span>[[admin:dashboard.reading_posts]]</span></li>
						<li><div class="browsing-topics"></div><span>[[admin:dashboard.browsing_topics]]</span></li>
						<li><div class="recent"></div><span>[[admin:dashboard.recent]]</span></li>
						<li><div class="unread"></div><span>[[admin:dashboard.unread]]</span></li>
					</ul>
					<canvas id="analytics-presence"></canvas>
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:dashboard.high_presence_topics]]</div>
			<div class="panel-body">
				<div class="graph-container pie-chart legend-down">
					<canvas id="analytics-topics"></canvas>
					<ul class="graph-legend" id="topics-legend"></ul>
				</div>
			</div>
		</div>



		<div class="panel panel-default">
			<div class="panel-heading">[[admin:dashboard.active_users]]</div>
			<div class="panel-body">
				<div id="active-users"></div>
			</div>
		</div>
	</div>
</div>