<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:email-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="email:from"><strong>[[admin/settings/email:address]]</strong></label>
				<p class="help-block">
					
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
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/email:gmail-routing]]</div>
	<div class="col-sm-10 col-xs-12">
		<div class="alert alert-warning">
			<p>
				[[admin/settings/email:gmail-routing-help1]]
			</p>
			<p>
				[[admin/settings/email:gmail-routing-help2]]
			</p>
		</div>
		<form>
			<div class="checkbox">
				<label for="email:GmailTransport:enabled" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="email:GmailTransport:enabled" data-field="email:GmailTransport:enabled" name="email:GmailTransport:enabled" />
					<span class="mdl-switch__label">[[admin/settings/email:gmail-transport]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="email:GmailTransport:user"><strong>[[admin/settings/email:gmail-transport.username]]</strong></label>
				<input type="text" class="form-control input-lg" id="email:GmailTransport:user" data-field="email:GmailTransport:user" placeholder="admin@example.org" />
				<p class="help-block">
					[[admin/settings/email:gmail-transport.username-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="email:GmailTransport:pass"><strong>[[admin/settings/email:gmail-transport.password]]</strong></label>
				<input type="password" class="form-control input-lg" id="email:GmailTransport:pass" data-field="email:GmailTransport:pass" />
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