<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="maintenance-mode" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:maintenance-mode]]</h5>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="maintenanceMode" data-field="maintenanceMode">
					<label for="maintenanceMode" class="form-check-label">[[admin/settings/advanced:maintenance-mode]]</label>
				</div>
				<p class="form-text">
					[[admin/settings/advanced:maintenance-mode.help]]
				</p>
				<div class="mb-3">
					<label class="form-label" for="maintenanceModeStatus">[[admin/settings/advanced:maintenance-mode.status]]</label>
					<input id="maintenanceModeStatus" class="form-control" type="text" data-field="maintenanceModeStatus">
				</div>
				<div class="mb-3">
					<label class="form-label" for="maintenanceModeMessage">[[admin/settings/advanced:maintenance-mode.message]]</label>
					<textarea id="maintenanceModeMessage" class="form-control" data-field="maintenanceModeMessage"></textarea>
				</div>
				<div class="form-group">
					<label class="form-label" for="groupsExemptFromMaintenanceMode">[[admin/settings/advanced:maintenance-mode.groups-exempt-from-maintenance-mode]]</label>
					<select id="groupsExemptFromMaintenanceMode" class="form-select" multiple data-field="groupsExemptFromMaintenanceMode">
						{{{ each groupsExemptFromMaintenanceMode }}}
						<option value="{groupsExemptFromMaintenanceMode.displayName}">{groupsExemptFromMaintenanceMode.displayName}</option>
						{{{ end }}}
					</select>
				</div>
			</div>

			<hr/>

			<div id="headers" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:headers]]</h5>

				<div class="mb-3">
					<label class="form-label" for="csp-frame-ancestors">[[admin/settings/advanced:headers.csp-frame-ancestors]]</label>
					<input class="form-control" id="csp-frame-ancestors" type="text" placeholder="https://a.example.com https://b.example.com" data-field="csp-frame-ancestors" />
					<p class="form-text">
						[[admin/settings/advanced:headers.csp-frame-ancestors-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="powered-by">[[admin/settings/advanced:headers.powered-by]]</label>
					<input class="form-control" id="powered-by" type="text" placeholder="NodeBB" data-field="powered-by" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="access-control-allow-origin">[[admin/settings/advanced:headers.acao]]</label>
					<input class="form-control" id="access-control-allow-origin" type="text" placeholder="" value="" data-field="access-control-allow-origin" />
					<p class="form-text">
						[[admin/settings/advanced:headers.acao-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="access-control-allow-origin-regex">[[admin/settings/advanced:headers.acao-regex]]</label>
					<input class="form-control" id="access-control-allow-origin-regex" type="text" placeholder="" value="" data-field="access-control-allow-origin-regex" />
					<p class="form-text">
						[[admin/settings/advanced:headers.acao-regex-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="access-control-allow-credentials">[[admin/settings/advanced:headers.acac]]</label>
					<input class="form-control" id="access-control-allow-credentials" type="text" placeholder="" value="" data-field="access-control-allow-credentials" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="access-control-allow-methods">[[admin/settings/advanced:headers.acam]]</label>
					<input class="form-control" id="access-control-allow-methods" type="text" placeholder="" data-field="access-control-allow-methods" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="access-control-allow-headers">[[admin/settings/advanced:headers.acah]]</label>
					<input class="form-control" id="access-control-allow-headers" type="text" placeholder="" data-field="access-control-allow-headers" />
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="cross-origin-embedder-policy" id="cross-origin-embedder-policy">
					<label for="cross-origin-embedder-policy" class="form-check-label">[[admin/settings/advanced:headers.coep]]</label>
				</div>
				<p class="form-text">[[admin/settings/advanced:headers.coep-help]]</p>
				<div class="mb-3">
					<label for="cross-origin-resource-policy">[[admin/settings/advanced:headers.coop]]</label>
					<select class="form-select" id="cross-origin-opener-policy" data-field="cross-origin-opener-policy">
						<option value="same-origin">same-origin</option>
						<option value="same-origin-allow-popups">same-origin-allow-popups</option>
						<option value="unsafe-none">unsafe-none</option>
					</select>
				</div>

				<div class="mb-3">
					<label for="cross-origin-resource-policy">[[admin/settings/advanced:headers.corp]]</label>
					<select class="form-select" id="cross-origin-resource-policy" data-field="cross-origin-resource-policy">
						<option value="same-site">same-site</option>
						<option value="same-origin">same-origin</option>
						<option value="cross-origin">cross-origin</option>
					</select>
				</div>

				<div class="">
					<label for="permissions-policy">[[admin/settings/advanced:headers.permissions-policy]]</label>
					<input class="form-control" id="permissions-policy" type="text" placeholder="" data-field="permissions-policy"  >
					<p class="form-text">[[admin/settings/advanced:headers.permissions-policy-help]]</p>
				</div>
			</div>

			<hr/>

			<div id="strict-transport-security" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:hsts]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="hsts-enabled" data-field="hsts-enabled" checked>
					<label for="hsts-enabled" class="form-check-label">[[admin/settings/advanced:hsts.enabled]]</label>
				</div>
				<div class="mb-3">
					<label class="form-label" for="hsts-maxage">[[admin/settings/advanced:hsts.maxAge]]</label>
					<input class="form-control" id="hsts-maxage" type="number" placeholder="31536000" data-field="hsts-maxage" />
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="hsts-subdomains" data-field="hsts-subdomains" checked>
					<label for="hsts-subdomains" class="form-check-label">[[admin/settings/advanced:hsts.subdomains]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="hsts-preload" data-field="hsts-preload">
					<label for="hsts-preload" class="form-check-label">[[admin/settings/advanced:hsts.preload]]</label>
				</div>
				<p class="form-text">
					[[admin/settings/advanced:hsts.help, https:\/\/hstspreload.org\/]]
				</p>

			</div>

			<hr/>

			<div id="websocket-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:sockets.settings]]</h5>
				<div class="mb-3">
					<label class="form-label" for="maxReconnectionAttempts">[[admin/settings/advanced:sockets.max-attempts]]</label>
					<input class="form-control" id="maxReconnectionAttempts" type="text" value="5" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 5]]" data-field="maxReconnectionAttempts" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="reconnectionDelay">[[admin/settings/advanced:sockets.delay]]</label>
					<input class="form-control" id="reconnectionDelay" type="text" value="1500" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 1500]]" data-field="reconnectionDelay" />
				</div>

			</div>

			<hr/>

			<div id="compression-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:compression.settings]]</h5>

				<div class="mb-3">
					<p class="form-text">
						[[admin/settings/advanced:compression.help]]
					</p>
					<div class="form-check form-switch">
						<input class="form-check-input" type="checkbox" id="useCompression" data-field="useCompression">
						<label for="useCompression" class="form-check-label">[[admin/settings/advanced:compression.enable]]</label>
					</div>
				</div>
			</div>

			<hr/>

			<div id="traffic-management" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/advanced:traffic-management]]</h5>

				<p class="form-text">
					[[admin/settings/advanced:traffic.help]]
				</p>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" id="eventLoopCheckEnabled" type="checkbox" data-field="eventLoopCheckEnabled" checked />
					<label class="form-check-label" for="eventLoopCheckEnabled">[[admin/settings/advanced:traffic.enable]]</label>
				</div>
				<div class="mb-3">
					<label class="form-label" for="eventLoopLagThreshold">[[admin/settings/advanced:traffic.event-lag]]</label>
					<input class="form-control" id="eventLoopLagThreshold" type="number" data-field="eventLoopLagThreshold" placeholder="Default: 70" step="10" min="10" value="70" />
					<p class="form-text">
						[[admin/settings/advanced:traffic.event-lag-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="eventLoopInterval">[[admin/settings/advanced:traffic.lag-check-interval]]</label>
					<input class="form-control" id="eventLoopInterval" type="number" data-field="eventLoopInterval" placeholder="Default: 500" value="500" step="50" />
					<p class="form-text">
						[[admin/settings/advanced:traffic.lag-check-interval-help]]
					</p>
				</div>

			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
