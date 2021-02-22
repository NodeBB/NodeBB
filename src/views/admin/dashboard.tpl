<div class="row dashboard">
	<div class="col-lg-9">
		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<div class="row">
			<div class="col-lg-4">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/dashboard:anonymous-registered-users]]</div>
					<div class="panel-body">
						<div class="graph-container pie-chart legend-down">
							<canvas id="analytics-registered"></canvas>
							<ul class="graph-legend" id="analytics-legend">
								<li><div class="registered"></div><span>(<span class="count"></span>) [[admin/dashboard:registered]]</span></li>
								<li><div class="anonymous"></div><span>(<span class="count"></span>) [[admin/dashboard:anonymous]]</span></li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div class="col-lg-4">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/dashboard:user-presence]]</div>
					<div class="panel-body">
						<div class="graph-container pie-chart legend-down">
							<canvas id="analytics-presence"></canvas>
							<ul class="graph-legend" id="analytics-presence-legend">
								<li><div class="reading-posts"></div><span>(<span class="count"></span>) [[admin/dashboard:reading-posts]]</span></li>
								<li><div class="on-categories"></div><span>(<span class="count"></span>) [[admin/dashboard:on-categories]]</span></li>
								<li><div class="browsing-topics"></div><span>(<span class="count"></span>) [[admin/dashboard:browsing-topics]]</span></li>
								<li><div class="recent"></div><span>(<span class="count"></span>) [[admin/dashboard:recent]]</span></li>
								<li><div class="unread"></div><span>(<span class="count"></span>) [[admin/dashboard:unread]]</span></li>
							</ul>
						</div>
					</div>
				</div>
			</div>
			<div class="col-lg-4">
				<div class="panel panel-default">
					<div class="panel-heading">[[admin/dashboard:high-presence-topics]]</div>
					<div class="panel-body">
						<div class="graph-container pie-chart legend-down">
							<canvas id="analytics-topics"></canvas>
							<ul class="graph-legend" id="topics-legend"></ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		{{{ if showSystemControls }}}
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/dashboard:control-panel]]</div>
			<div class="panel-body text-center">
				<p>
					<button class="btn btn-block btn-warning restart"<!-- IF !canRestart --> disabled<!-- END -->>[[admin/dashboard:restart]]</button>
					<button class="btn btn-block btn-danger rebuild-and-restart"<!-- IF !canRestart --> disabled<!-- END -->>[[admin/dashboard:rebuild-and-restart]]</button>
				</p>
				<!-- IF lastrestart -->
				<p>
					[[admin/dashboard:last-restarted-by]]<br />
					<a href="{config.relative_path}/uid/{lastrestart.uid}"><span class="label label-info">{lastrestart.user.username}</span></a> <span class="timeago" title="{lastrestart.timestampISO}"></span>
				</p>
				<!-- ENDIF lastrestart -->
				<p class="<!-- IF canRestart -->help-block<!-- ELSE -->alert alert-warning<!-- END -->">
					<!-- IF canRestart -->
					[[admin/dashboard:restart-warning]]
					<!-- ELSE -->
					[[admin/dashboard:restart-disabled]]
					<!-- END -->
				</p>
				<p>
					<a href="{config.relative_path}/admin/settings/advanced" class="btn btn-info btn-block" data-placement="bottom" data-toggle="tooltip" title="[[admin/dashboard:maintenance-mode-title]]">[[admin/dashboard:maintenance-mode]]</a>
				</p>

				<hr />
				<span id="toggle-realtime">[[admin/dashboard:realtime-chart-updates]] <strong>OFF</strong> <i class="fa fa fa-toggle-off pointer"></i></span>
			</div>
		</div>
		{{{ end }}}

		<div class="panel panel-default">
			<div class="panel-heading">[[admin/dashboard:active-users]]</div>
			<div class="panel-body">
				<div id="active-users" class="stats"></div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin/dashboard:updates]]</div>
			<div class="panel-body">
				<div class="alert <!-- IF lookupFailed -->alert-danger<!-- ELSE --><!-- IF upgradeAvailable -->alert-warning<!-- ELSE --><!-- IF currentPrerelease -->alert-info<!-- ELSE -->alert-success<!-- END --><!-- END --><!-- END --> version-check">
					<p>[[admin/dashboard:running-version, {version}]]</p>
					<p>
					<!-- IF lookupFailed -->
					[[admin/dashboard:latest-lookup-failed]]
					<!-- ELSE -->
						<!-- IF upgradeAvailable -->
							<!-- IF currentPrerelease -->
							[[admin/dashboard:prerelease-upgrade-available, {latestVersion}]]
							<!-- ELSE -->
							[[admin/dashboard:upgrade-available, {latestVersion}]]
							<!-- END -->
						<!-- ELSE -->
							<!-- IF currentPrerelease -->
							[[admin/dashboard:prerelease-warning]]
							<!-- ELSE -->
							[[admin/dashboard:up-to-date]]
							<!-- END -->
						<!-- END -->
					<!-- END -->
					</p>
				</div>
				<p>
					[[admin/dashboard:keep-updated]]
				</p>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin/dashboard:notices]]</div>
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