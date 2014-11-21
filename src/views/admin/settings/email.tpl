<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Email Settings</div>
	<div class="panel-body">
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
			<button class="btn btn-block btn-default" type="button" data-action="email.test">Send Test Email</button>
			<p class="help-block">
				The test email will be sent to the currently logged in user's email address.
			</p>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Email Subscriptions</div>
	<div class="panel-body">
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