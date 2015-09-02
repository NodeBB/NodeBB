<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:advanced.maintenance_mode]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="maintenanceMode">
					<span class="mdl-switch__label"><strong>[[admin:advanced.maintenance_mode]]</strong></span>
				</label>
			</div>
			<p class="help-block">
				[[admin:advanced.help]]
			</p>
			<div class="form-group">
				<label for="maintenanceModeMessage">[[admin:advanced.maintenance_message]]</label>
				<textarea class="form-control" data-field="maintenanceModeMessage"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:advanced.domain_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="allow-from-uri">[[admin:advanced.set_allow_from_to_place_nodebb_in_an_iframe]]</label>
				<input class="form-control" id="allow-from-uri" type="text" placeholder="external-domain.com" data-field="allow-from-uri" /><br />
			</div>
			<div class="form-group">
				<label for="cookieDomain">[[admin:advanced.set_domain_for_session_cookie]]</label>
				<input class="form-control" id="cookieDomain" type="text" placeholder=".domain.tld" data-field="cookieDomain" /><br />
				<p class="help-block">[[admin:advanced.leave_blank_for_default]]</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
