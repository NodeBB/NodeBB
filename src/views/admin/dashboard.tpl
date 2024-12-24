<div class="row dashboard px-lg-4">
	<div class="col-lg-8 col-xl-9">
		<!-- IMPORT admin/partials/dashboard/graph.tpl -->
		<!-- IMPORT admin/partials/dashboard/stats.tpl -->

		<div class="row">
			<div class="col-lg-4">
				<div class="card">
					<div class="card-header">[[admin/dashboard:guest-registered-users]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down position-relative mb-3 px-3 mx-auto" style="aspect-ratio: 1;">
							<canvas id="analytics-registered"></canvas>
						</div>
						<ul class="graph-legend list-unstyled" id="analytics-legend">
							<li><div class="registered"></div><span>(<span class="count"></span>) [[admin/dashboard:registered]]</span></li>
							<li><div class="guest"></div><span>(<span class="count"></span>) [[admin/dashboard:guest]]</span></li>
						</ul>
					</div>
				</div>
			</div>

			<div class="col-lg-4">
				<div class="card">
					<div class="card-header">[[admin/dashboard:user-presence]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down position-relative mb-3 px-3 mx-auto" style="aspect-ratio: 1;">
							<canvas id="analytics-presence"></canvas>
						</div>
						<ul class="graph-legend list-unstyled" id="analytics-presence-legend">
							<li><div class="reading-posts"></div><span>(<span class="count"></span>) [[admin/dashboard:reading-posts]]</span></li>
							<li><div class="on-categories"></div><span>(<span class="count"></span>) [[admin/dashboard:on-categories]]</span></li>
							<li><div class="browsing-topics"></div><span>(<span class="count"></span>) [[admin/dashboard:browsing-topics]]</span></li>
							<li><div class="recent"></div><span>(<span class="count"></span>) [[admin/dashboard:recent]]</span></li>
							<li><div class="unread"></div><span>(<span class="count"></span>) [[admin/dashboard:unread]]</span></li>
						</ul>
					</div>
				</div>
			</div>
			<div class="col-lg-4">
				<div class="card">
					<div class="card-header">[[admin/dashboard:high-presence-topics]]</div>
					<div class="card-body">
						<div class="graph-container pie-chart legend-down position-relative mb-3 px-3 mx-auto" style="aspect-ratio: 1;">
							<canvas id="analytics-topics"></canvas>
						</div>
						<ul class="graph-legend list-unstyled" id="topics-legend"></ul>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-4 col-xl-3">
		<div class="card mb-3">
			<div class="card-body">
				<div class="text-sm shadow-sm alert {{{ if lookupFailed }}}alert-danger{{{ else }}}{{{ if upgradeAvailable }}}alert-warning{{{ else }}}{{{ if currentPrerelease }}}alert-info{{{ else }}}alert-success{{{ end }}}{{{ end }}}{{{ end }}} version-check">
					<p class="">[[admin/dashboard:running-version, {version}]]</p>
					<p class="mb-0">
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
				<p class="form-text">
					[[admin/dashboard:keep-updated]]
				</p>
				<hr/>
				{{{ if showSystemControls }}}

				<a href="{config.relative_path}/admin/settings/advanced" class="d-block mb-2 btn btn-info btn-sm" data-bs-placement="bottom" data-bs-toggle="tooltip" title="[[admin/dashboard:maintenance-mode-title]]">[[admin/dashboard:maintenance-mode]]</a>

				<div class="form-check form-switch">
					<label for="toggle-realtime" class="form-check-label text-sm">[[admin/dashboard:realtime-chart-updates]]</label>
					<input id="toggle-realtime" class="form-check-input" type="checkbox">
				</div>

				<div class="form-check form-switch">
					<label for="toggle-dark-mode" class="form-check-label text-sm">[[admin/dashboard:dark-mode]]</label>
					<input id="toggle-dark-mode" class="form-check-input" type="checkbox">
				</div>
				{{{ end }}}
				<hr/>
				<h6>[[admin/dashboard:notices]]</h6>
				{{{ each notices}}}
				<div class="text-sm">
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

		<div class="card mb-3">
			<div class="card-header">[[admin/dashboard:active-users]]</div>
			<div class="card-body">
				<div id="active-users" class="stats">
					<table class="table table-sm text-sm">
						<tbody>
							<tr>
								<td>[[admin/dashboard:active-users.users]]</td>
								<td id="active-users-loggedin" class="text-end" style="width: 1px;"></td>
							</tr>
							<tr>
								<td>[[admin/dashboard:active-users.guests]]</td>
								<td id="active-users-guests" class="text-end" style="width: 1px;"></td>
							</tr>
							<tr>
								<td>[[admin/dashboard:active-users.total]]</td>
								<td id="active-users-total" class="text-end" style="width: 1px;"></td>
							</tr>
							<tr>
								<td>[[admin/dashboard:active-users.connections]]</td>
								<td id="active-users-connections" class="text-end" style="width: 1px;"></td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header d-flex justify-content-between">[[admin/dashboard:popular-searches]] <a href="{config.relative_path}/admin/dashboard/searches" class="text-xs">[[admin/dashboard:view-all]]</a></div>
			<div class="card-body">
				<table class="table table-sm text-sm search-list w-100">
					<tbody>
						{{{ each popularSearches }}}
						<tr>
							<td class="w-100 text-truncate" style="max-width:1px;">{popularSearches.value}</td>
							<td class="w-0 text-end text-nowrap">{formattedNumber(popularSearches.score)}</td>
						</tr>
						{{{ end }}}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>