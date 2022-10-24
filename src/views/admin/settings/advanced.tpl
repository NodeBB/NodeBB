<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:maintenance-mode]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="maintenanceMode">
				<label class="form-check-label">[[admin/settings/advanced:maintenance-mode]]</label>
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
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:headers]]</div>
	<div class="col-sm-10 col-12">
		<form>
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
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="cross-origin-embedder-policy" id="cross-origin-embedder-policy">
				<label class="form-check-label">[[admin/settings/advanced:headers.coep]]</label>
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
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:hsts]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="hsts-enabled" checked>
				<label class="form-check-label">[[admin/settings/advanced:hsts.enabled]]</label>
			</div>
			<div class="mb-3">
				<label class="form-label" for="hsts-maxage">[[admin/settings/advanced:hsts.maxAge]]</label>
				<input class="form-control" id="hsts-maxage" type="number" placeholder="31536000" data-field="hsts-maxage" />
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="hsts-subdomains" checked>
				<label class="form-check-label">[[admin/settings/advanced:hsts.subdomains]]</label>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="hsts-preload">
				<label class="form-check-label">[[admin/settings/advanced:hsts.preload]]</label>
			</div>
			<p class="form-text">
				[[admin/settings/advanced:hsts.help, https:\/\/hstspreload.org\/]]
			</p>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:traffic-management]]</div>
	<div class="col-sm-10 col-12">
		<p class="form-text">
			[[admin/settings/advanced:traffic.help]]
		</p>
		<form>
			<div class="form-check form-switch">
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
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:sockets.settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="maxReconnectionAttempts">[[admin/settings/advanced:sockets.max-attempts]]</label>
				<input class="form-control" id="maxReconnectionAttempts" type="text" value="5" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 5]]" data-field="maxReconnectionAttempts" />
			</div>
			<div class="mb-3">
				<label class="form-label" for="reconnectionDelay">[[admin/settings/advanced:sockets.delay]]</label>
				<input class="form-control" id="reconnectionDelay" type="text" value="1500" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 1500]]" data-field="reconnectionDelay" />
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:analytics.settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="analytics:maxCache">[[admin/settings/advanced:analytics.max-cache]]</label>
				<input class="form-control" id="analytics:maxCache" type="text" value="500" placeholder="500" data-field="analytics:maxCache" />
				<p class="form-text">
					[[admin/settings/advanced:analytics.max-cache-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/advanced:compression.settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<p class="form-text">
					[[admin/settings/advanced:compression.help]]
				</p>
				<div class="form-check form-switch">
					<input class="form-check-input" type="checkbox" data-field="useCompression">
					<label class="form-check-label">[[admin/settings/advanced:compression.enable]]</label>
				</div>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
