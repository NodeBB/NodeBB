<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Email Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="email:from"><strong>Email Address</strong></label>
				<p class="help-block">
					The following email address refers to the email that the recipient will see in the "From" and "Reply To" fields.
				</p>
				<input type="text" class="form-control input-lg" id="email:from" data-field="email:from" placeholder="info@example.org" /><br />
			</div>
			<div class="form-group">
				<label for="email:from_name"><strong>From Name</strong></label>
				<p class="help-block">
					The from name to display in the email.
				</p>
				<input type="text" class="form-control input-lg" id="email:from_name" data-field="email:from_name" placeholder="NodeBB" /><br />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Gmail Routing</div>
	<div class="col-sm-10 col-xs-12">
		<div class="alert alert-warning">
			<p>
				There have been reports of Gmail Routing not working on accounts with heightened security. In those scenarios,
				you will have to <a href="https://www.google.com/settings/security/lesssecureapps">configure your GMail account
				to allow less secure apps</a>.
			</p>
			<p>
				For more information about this workaround, <a href="https://nodemailer.com/using-gmail/">please consult
				this NodeMailer article on the issue.</a> An alternative would be to utilise a third-party emailer plugin
				such as SendGrid, Mailgun, etc. <a href="{config.relative_path}/admin/extend/plugins">Browse available plugins
				here</a>.
			</p>
		</div>
		<form>
			<div class="checkbox">
				<label for="email:GmailTransport:enabled" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="email:GmailTransport:enabled" data-field="email:GmailTransport:enabled" name="email:GmailTransport:enabled" />
					<span class="mdl-switch__label">Route emails through a Gmail/Google Apps account</span>
				</label>
			</div>
			<div class="form-group">
				<label for="email:GmailTransport:user"><strong>Username</strong></label>
				<input type="text" class="form-control input-lg" id="email:GmailTransport:user" data-field="email:GmailTransport:user" placeholder="admin@example.org" />
				<p class="help-block">
					Enter the full email address here, especially if you are using a Google Apps managed domain.
				</p>
			</div>
			<div class="form-group">
				<label for="email:GmailTransport:pass"><strong>Password</strong></label>
				<input type="password" class="form-control input-lg" id="email:GmailTransport:pass" data-field="email:GmailTransport:pass" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Edit Email Template</div>
	<div class="col-sm-10 col-xs-12">
		<label>Select Email Template</label><br />
		<select id="email-editor-selector" class="form-control">
			<!-- BEGIN emails -->
			<option value="{emails.path}">{emails.path}</option>
			<!-- END emails -->
		</select>
		<br />
		<div id="email-editor"></div>
		<input type="hidden" id="email-editor-holder" value="" data-field="" />
		<br />
		<button class="btn btn-warning" type="button" data-action="email.revert">Revert to Original</button>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Email Testing</div>
	<div class="col-sm-10 col-xs-12">
		<div class="form-group">
			<label>Select Email Template</label>
			<select id="test-email" class="form-control">
				<!-- BEGIN sendable -->
				<option value="{sendable.path}">{sendable.path}</option>
				<!-- END sendable -->
			</select>
		</div>
		<button class="btn btn-primary" type="button" data-action="email.test">Send Test Email</button>
		<p class="help-block">
			The test email will be sent to the currently logged in user's email address.
		</p>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Email Subscriptions</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label for="disableEmailSubscriptions" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" />
					<span class="mdl-switch__label">Disable subscriber notification emails</span>
				</label>
			</div>

			<div class="form-group">
				<label for="digestHour"><strong>Digest Hour</strong></label>
				<input type="number" class="form-control input-lg" id="digestHour" data-field="digestHour" placeholder="17" min="0" max="24" />
				<p class="help-block">
					Please enter a number representing the hour to send scheduled email digests (e.g. <code>0</code> for midnight, <code>17</code> for 5:00pm).
					Keep in mind that this is the hour according to the server itself, and may not exactly match your system clock.<br />
					The approximate server time is: <span id="serverTime"></span><br />
					The next daily digest is scheduled to be sent  <span id="nextDigestTime"></span>
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->