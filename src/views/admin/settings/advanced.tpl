<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">[[admin:advanced.maintenance_mode]]</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="maintenanceMode"> <strong>[[admin:advanced.maintenance_mode]]</strong>
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

<div class="panel panel-default">
	<div class="panel-heading">[[admin:advanced.domain_settings]]</div>
	<div class="panel-body">
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