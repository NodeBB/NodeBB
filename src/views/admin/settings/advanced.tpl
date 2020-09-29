<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:maintenance-mode]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="maintenanceMode">
					<span class="mdl-switch__label"><strong>[[admin/settings/advanced:maintenance-mode]]</strong></span>
				</label>
			</div>
			<p class="help-block">
				[[admin/settings/advanced:maintenance-mode.help]]
			</p>
			<div class="form-group">
				<label for="maintenanceModeStatus">[[admin/settings/advanced:maintenance-mode.status]]</label>
				<input class="form-control" type="text" data-field="maintenanceModeStatus">
			</div>
			<div class="form-group">
				<label for="maintenanceModeMessage">[[admin/settings/advanced:maintenance-mode.message]]</label>
				<textarea class="form-control" data-field="maintenanceModeMessage"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:headers]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="csp-frame-ancestors">[[admin/settings/advanced:headers.csp-frame-ancestors]]</label>
				<input class="form-control" id="csp-frame-ancestors" type="text" placeholder="https://a.example.com https://b.example.com" data-field="csp-frame-ancestors" /><br />
				<p class="help-block">
					[[admin/settings/advanced:headers.csp-frame-ancestors-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="powered-by">[[admin/settings/advanced:headers.powered-by]]</label>
				<input class="form-control" id="powered-by" type="text" placeholder="NodeBB" data-field="powered-by" /><br />
			</div>
			<div class="form-group">
				<label for="access-control-allow-origin">[[admin/settings/advanced:headers.acao]]</label>
				<input class="form-control" id="access-control-allow-origin" type="text" placeholder="" value="" data-field="access-control-allow-origin" /><br />
				<p class="help-block">
					[[admin/settings/advanced:headers.acao-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="access-control-allow-origin-regex">[[admin/settings/advanced:headers.acao-regex]]</label>
				<input class="form-control" id="access-control-allow-origin-regex" type="text" placeholder="" value="" data-field="access-control-allow-origin-regex" /><br />
				<p class="help-block">
					[[admin/settings/advanced:headers.acao-regex-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="access-control-allow-credentials">[[admin/settings/advanced:headers.acac]]</label>
				<input class="form-control" id="access-control-allow-credentials" type="text" placeholder="" value="" data-field="access-control-allow-credentials" /><br />
			</div>
			<div class="form-group">
				<label for="access-control-allow-methods">[[admin/settings/advanced:headers.acam]]</label>
				<input class="form-control" id="access-control-allow-methods" type="text" placeholder="" data-field="access-control-allow-methods" /><br />
			</div>
			<div class="form-group">
				<label for="access-control-allow-headers">[[admin/settings/advanced:headers.acah]]</label>
				<input class="form-control" id="access-control-allow-headers" type="text" placeholder="" data-field="access-control-allow-headers" /><br />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:hsts]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="hsts-enabled" checked>
					<span class="mdl-switch__label"><strong>[[admin/settings/advanced:hsts.enabled]]</strong></span>
				</label>
			</div>
			<div class="form-group">
				<label for="hsts-maxage">[[admin/settings/advanced:hsts.maxAge]]</label>
				<input class="form-control" id="hsts-maxage" type="number" placeholder="31536000" data-field="hsts-maxage" /><br />
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="hsts-subdomains" checked>
					<span class="mdl-switch__label"><strong>[[admin/settings/advanced:hsts.subdomains]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="hsts-preload">
					<span class="mdl-switch__label"><strong>[[admin/settings/advanced:hsts.preload]]</strong></span>
				</label>
			</div>
			<p class="help-block">
				[[admin/settings/advanced:hsts.help, https:\/\/hstspreload.org\/]]
			</p>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:traffic-management]]</div>
	<div class="col-sm-10 col-xs-12">
		<p class="help-block">
			[[admin/settings/advanced:traffic.help]]
		</p>
		<form>
			<div class="form-group">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="eventLoopCheckEnabled">
					<input class="mdl-switch__input" id="eventLoopCheckEnabled" type="checkbox" data-field="eventLoopCheckEnabled" checked />
					<span class="mdl-switch__label">[[admin/settings/advanced:traffic.enable]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="eventLoopLagThreshold">[[admin/settings/advanced:traffic.event-lag]]</label>
				<input class="form-control" id="eventLoopLagThreshold" type="number" data-field="eventLoopLagThreshold" placeholder="Default: 70" step="10" min="10" value="70" />
				<p class="help-block">
					[[admin/settings/advanced:traffic.event-lag-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="eventLoopInterval">[[admin/settings/advanced:traffic.lag-check-interval]]</label>
				<input class="form-control" id="eventLoopInterval" type="number" data-field="eventLoopInterval" placeholder="Default: 500" value="500" step="50" />
				<p class="help-block">
					[[admin/settings/advanced:traffic.lag-check-interval-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:sockets.settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="maxReconnectionAttempts">[[admin/settings/advanced:sockets.max-attempts]]</label>
				<input class="form-control" id="maxReconnectionAttempts" type="text" value="5" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 5]]" data-field="maxReconnectionAttempts" />
			</div>
			<div class="form-group">
				<label for="reconnectionDelay">[[admin/settings/advanced:sockets.delay]]</label>
				<input class="form-control" id="reconnectionDelay" type="text" value="1500" placeholder="[[admin/settings/advanced:sockets.default-placeholder, 1500]]" data-field="reconnectionDelay" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/advanced:analytics.settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="analytics:maxCache">[[admin/settings/advanced:analytics.max-cache]]</label>
				<input class="form-control" id="analytics:maxCache" type="text" value="500" placeholder="500" data-field="analytics:maxCache" />
				<p class="help-block">
					[[admin/settings/advanced:analytics.max-cache-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
