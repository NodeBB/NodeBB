<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Email Settings</div>
	<div class="col-xs-10">
		<form>
			<p>
				Please ensure that you have installed a third-party emailer (e.g. PostageApp, Mailgun, Mandrill, SendGrid, etc), otherwise emails will not be sent by NodeBB
			</p>
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
			<button class="btn btn-primary" type="button" data-action="email.test">Send Test Email</button>
			<p class="help-block">
				The test email will be sent to the currently logged in user's email address.
			</p>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Email Subscriptions</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label for="disableEmailSubscriptions">
					<input type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" /> Disable subscriber notification emails
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->