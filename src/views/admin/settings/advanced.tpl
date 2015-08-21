<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Maintenance Mode</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="maintenanceMode">
					<span class="mdl-switch__label"><strong>Maintenance Mode</strong></span>
				</label>
			</div>
			<p class="help-block">
				When the forum is in maintenance mode, all requests will be redirected to a static holding page.
				Administrators are exempt from this redirection, and are able to access the site normally.
			</p>
			<div class="form-group">
				<label for="maintenanceModeMessage">Maintenance Message</label>
				<textarea class="form-control" data-field="maintenanceModeMessage"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Domain Settings</div>
	<div class="col-xs-10">
		<form>
			<div class="form-group">
				<label for="allow-from-uri">Set ALLOW-FROM to Place NodeBB in an iFrame:</label>
				<input class="form-control" id="allow-from-uri" type="text" placeholder="external-domain.com" data-field="allow-from-uri" /><br />
			</div>
			<div class="form-group">
				<label for="cookieDomain">Set domain for session cookie</label>
				<input class="form-control" id="cookieDomain" type="text" placeholder=".domain.tld" data-field="cookieDomain" /><br />
				<p class="help-block">
					Leave blank for default
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->