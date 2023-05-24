<div class="row dashboard">
	<div class="col-lg-9">
		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<div class="row">
			<div class="col-lg-3">
				<div class="card">
					<div class="card-header">[[admin/dashboard:guest-registered-users]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down">
							<canvas id="analytics-registered"></canvas>
							<ul class="graph-legend" id="analytics-legend">
								<li><div class="registered"></div><span>(<span class="count"></span>) [[admin/dashboard:registered]]</span></li>
								<li><div class="guest"></div><span>(<span class="count"></span>) [[admin/dashboard:guest]]</span></li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div class="col-lg-3">
				<div class="card">
					<div class="card-header">[[admin/dashboard:user-presence]]</div>
					<div class="card-body">
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
			<div class="col-lg-3">
				<div class="card">
					<div class="card-header">[[admin/dashboard:high-presence-topics]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down">
							<canvas id="analytics-topics"></canvas>
							<ul class="graph-legend" id="topics-legend"></ul>
						</div>
					</div>
				</div>
			</div>
			<div class="col-lg-3">
				<div class="card">
					<div class="card-header">[[admin/dashboard:popular-searches]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down">
							<ul class="graph-legend" id="popular-searches-legend">
								{{{ each popularSearches}}}
								<li>({popularSearches.score}) {popularSearches.value}</li>
								{{{ end }}}
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		{{{ if showSystemControls }}}
		<div class="card mb-3">
			<div class="card-header">[[admin/dashboard:control-panel]]</div>
			<div class="card-body text-center">
				<div class="d-grid gap-2 mb-2">
					<button component="restart" class="btn btn-block btn-warning"{{{ if !canRestart }}} disabled{{{ end }}}>[[admin/dashboard:restart]]</button>
					<button component="rebuild-and-restart" class="btn btn-block btn-danger"{{{ if !canRestart }}} disabled{{{ end }}}>[[admin/dashboard:rebuild-and-restart]]</button>
				</div>
				{{{ if lastrestart }}}
				<p>
					[[admin/dashboard:last-restarted-by]]<br />
					<a href="{config.relative_path}/uid/{lastrestart.uid}"><span class="badge bg-info">{lastrestart.user.username}</span></a> <span class="timeago" title="{lastrestart.timestampISO}"></span>
				</p>
				{{{ end }}}
				<p class="{{{ if canRestart }}}form-text{{{ else }}}alert alert-warning{{{ end }}}">
					{{{ if canRestart }}}
					[[admin/dashboard:restart-warning]]
					{{{ else }}}
					[[admin/dashboard:restart-disabled]]
					{{{ end }}}
				</p>
				<p>
					<a href="{config.relative_path}/admin/settings/advanced" class="btn btn-info btn-block" data-bs-placement="bottom" data-bs-toggle="tooltip" title="[[admin/dashboard:maintenance-mode-title]]">[[admin/dashboard:maintenance-mode]]</a>
				</p>

				<hr />
				<span id="toggle-realtime">[[admin/dashboard:realtime-chart-updates]] <strong>OFF</strong> <i class="fa fa fa-toggle-off pointer"></i></span>
			</div>
		</div>
		{{{ end }}}

		<div class="card mb-3">
			<div class="card-header">[[admin/dashboard:active-users]]</div>
			<div class="card-body">
				<div id="active-users" class="stats"></div>
			</div>
		</div>

		<div class="card mb-3">
			<div class="card-header">[[admin/dashboard:updates]]</div>
			<div class="card-body">
				<div class="alert {{{ if lookupFailed }}}alert-danger{{{ else }}}{{{ if upgradeAvailable }}}alert-warning{{{ else }}}{{{ if currentPrerelease }}}alert-info{{{ else }}}alert-success{{{ end }}}{{{ end }}}{{{ end }}} version-check">
					<p>[[admin/dashboard:running-version, {version}]]</p>
					<p>
					{{{ if lookupFailed }}}
					[[admin/dashboard:latest-lookup-failed]]
					{{{ else }}}
						{{{ if upgradeAvailable }}}
							{{{ if currentPrerelease }}}
							[[admin/dashboard:prerelease-upgrade-available, {latestVersion}]]
							{{{ else }}}
							[[admin/dashboard:upgrade-available, {latestVersion}]]
							{{{ end }}}
						{{{ else }}}
							{{{ if currentPrerelease }}}
							[[admin/dashboard:prerelease-warning]]
							{{{ else }}}
							[[admin/dashboard:up-to-date]]
							{{{ end }}}
						{{{ end }}}
					{{{ end }}}
					</p>
				</div>
				<p>
					[[admin/dashboard:keep-updated]]
				</p>
			</div>
		</div>

		<div class="card">
			<div class="card-header">[[admin/dashboard:notices]]</div>
			<div class="card-body">
			{{{ each notices}}}
				<div>
					{{{ if ./done }}}
					<i class="fa fa-fw fa-check text-success"></i> {./doneText}
					{{{ else }}}
					{{{ if ./link }}}<a href="{config.relative_path}{./link}" data-bs-toggle="tooltip" title="{./tooltip}">{{{ end }}}
					<i class="fa fa-fw fa-times text-danger"></i> {./notDoneText}
					{{{ if ./link }}}</a>{{{ end }}}
					{{{ end }}}
				</div>
			{{{ end }}}
			</div>
		</div>
	</div>
</div>