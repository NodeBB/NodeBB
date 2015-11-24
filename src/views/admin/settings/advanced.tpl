<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Maintenance Mode</div>
	<div class="col-sm-10 col-xs-12">
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
	<div class="col-sm-2 col-xs-12 settings-header">Domain Settings</div>
	<div class="col-sm-10 col-xs-12">
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

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Traffic Management</div>
	<div class="col-sm-10 col-xs-12">
		<p class="help-block">
			NodeBB deploys equipped with a module that automatically denies requests in high-traffic
			situations. You can tune these settings here, although the defaults are a good starting
			point.
		</p>
		<form>
			<div class="form-group">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="eventLoopCheckEnabled">
					<input class="mdl-switch__input" id="eventLoopCheckEnabled" type="checkbox" data-field="eventLoopCheckEnabled" checked />
					<span class="mdl-switch__label">Enable Traffic Management</span>
				</label>
			</div>
			<div class="form-group">
				<label for="eventLoopLagThreshold">Event Loop Lag Threshold (in milliseconds)</label>
				<input class="form-control" id="eventLoopLagThreshold" type="number" data-field="eventLoopLagThreshold" placeholder="Default: 70" step="10" value="70" />
				<p class="help-block">
					Lowering this value decreases wait times for page loads, but will also show the
					"excessive load" message to more users. (Reload required)
				</p>
			</div>
			<div class="form-group">
				<label for="eventLoopInterval">Check Interval (in milliseconds)</label>
				<input class="form-control" id="eventLoopInterval" type="number" data-field="eventLoopInterval" placeholder="Default: 500" value="500" step="50" />
				<p class="help-block">
					Lowering this value causes NodeBB to become more sensitive to spikes in load, but
					may also cause the check to become too sensitive. (Reload required)
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->