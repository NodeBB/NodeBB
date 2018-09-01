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
				<label for="allow-from-uri">[[admin/settings/advanced:headers.allow-from]]</label>
				<input class="form-control" id="allow-from-uri" type="text" placeholder="external-domain.com" data-field="allow-from-uri" /><br />
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

<!-- IMPORT admin/partials/settings/footer.tpl -->
