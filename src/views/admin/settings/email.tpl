<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:email-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="email:from"><strong>[[admin/settings/email:address]]</strong></label>
				<p class="help-block">
					[[admin/settings/email:address-help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from" data-field="email:from" placeholder="info@example.org" /><br />
			</div>
			<div class="form-group">
				<label for="email:from_name"><strong>From Name</strong></label>
				<p class="help-block">
					[[admin/settings/email:from-help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from_name" data-field="email:from_name" placeholder="NodeBB" /><br />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:smtp-transport]]</div>
	<div class="col-sm-10 col-xs-12">
		<div class="alert alert-warning">
			<p>
				[[admin/settings/email:smtp-transport-help]]
			</p>
		</div>
		<form>
			<div class="checkbox">
				<label for="email:smtpTransport:enabled" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="email:smtpTransport:enabled" data-field="email:smtpTransport:enabled" name="email:smtpTransport:enabled" />
					<span class="mdl-switch__label">[[admin/settings/email:smtp-transport.enabled]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="email:smtpTransport:service"><strong>[[admin/settings/email:smtp-transport.service]]</strong></label>
				<select class="form-control input-lg" id="email:smtpTransport:service" data-field="email:smtpTransport:service">
					<option value="nodebb-custom-smtp" style="font-weight: bold">[[admin/settings/email:smtp-transport.service-custom]]</option>
					<option style="font-size: 10px" disabled>&nbsp;</option>

					<!-- BEGIN services -->
					<option value="@value">@value</option>
					<!-- END services -->
				</select>
				<p class="help-block">
					[[admin/settings/email:smtp-transport.service-help]]
					<br>
					[[admin/settings/email:smtp-transport.gmail-warning1]]
					<br>
					[[admin/settings/email:smtp-transport.gmail-warning2]]
				</p>
			</div>
			<div class="form-group well" id="email:smtpTransport:custom-service" style="display: none">
				<h5>Custom Service</h5>

				<label for="email:smtpTransport:host">[[admin/settings/email:smtp-transport.host]]</label>
				<input type="text" class="form-control input-md" id="email:smtpTransport:host" data-field="email:smtpTransport:host" placeholder="smtp.example.org">

				<label for="email:smtpTransport:port">[[admin/settings/email:smtp-transport.port]]</label>
				<input type="text" class="form-control input-md" id="email:smtpTransport:port" data-field="email:smtpTransport:port" placeholder="5555">

				<label for="email:smtpTransport:security">[[admin/settings/email:smtp-transport.security]]</label>
				<select class="form-control" id="email:smtpTransport:security" data-field="email:smtpTransport:security">
					<option value="ENCRYPTED">[[admin/settings/email:smtp-transport.security-encrypted]]</option>
					<option value="STARTTLS">[[admin/settings/email:smtp-transport.security-starttls]]</option>
					<option value="NONE">[[admin/settings/email:smtp-transport.security-none]]</option>
				</select>
			</div>
			<div class="form-group">
				<label for="email:smtpTransport:user"><strong>[[admin/settings/email:smtp-transport.username]]</strong></label>
				<input type="text" class="form-control input-lg" data-field="email:smtpTransport:user" placeholder="admin@example.org" />
				<p class="help-block">
					[[admin/settings/email:smtp-transport.username-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="email:smtpTransport:pass"><strong>[[admin/settings/email:smtp-transport.password]]</strong></label>
				<input type="password" class="form-control input-lg" data-field="email:smtpTransport:pass" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:template]]</div>
	<div class="col-sm-10 col-xs-12">
		<label>[[admin/settings/email:template.select]]</label><br />
		<select id="email-editor-selector" class="form-control">
			<!-- BEGIN emails -->
			<option value="{emails.path}">{emails.path}</option>
			<!-- END emails -->
		</select>
		<br />
		<div id="email-editor"></div>
		<input type="hidden" id="email-editor-holder" value="" data-field="" />
		<br />
		<button class="btn btn-warning" type="button" data-action="email.revert">[[admin/settings/email:template.revert]]</button>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:testing]]</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<label>[[admin/settings/email:testing.select]]</label>
			<select id="test-email" class="form-control">
				<!-- BEGIN sendable -->
				<option value="{sendable.path}">{sendable.path}</option>
				<!-- END sendable -->
			</select>
		</div>
		<button class="btn btn-primary" type="button" data-action="email.test">[[admin/settings/email:testing.send]]</button>
		<p class="help-block">
			[[admin/settings/email:testing.send-help]]
		</p>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:subscriptions]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label for="disableEmailSubscriptions" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" />
					<span class="mdl-switch__label">[[admin/settings/email:subscriptions.disable]]</span>
				</label>
			</div>

			<div class="form-group">
				<label for="digestHour"><strong>[[admin/settings/email:subscriptions.hour]]</strong></label>
				<input type="number" class="form-control input-lg" id="digestHour" data-field="digestHour" placeholder="17" min="0" max="24" />
				<p class="help-block">
					[[admin/settings/email:subscriptions.hour-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
