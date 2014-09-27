<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Maintenance Mode</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="maintenanceMode"> <strong>Maintenance Mode</strong>
				</label>
			</div>
			<p class="help-block">
				When the forum is in maintenance mode, all requests will be redirected to a static holding page.
				Administrators are exempt from this redirection, and are able to access the site normally.
			</p>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Domain Settings</div>
	<div class="panel-body">
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