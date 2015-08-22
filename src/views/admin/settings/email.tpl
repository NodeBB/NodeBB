<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">[[admin:email.email_settings]]</div>
	<div class="panel-body">
		<form>
			<p>
			    [[admin:email.email_settings_help]]
			</p>
			<div class="form-group">
				<label for="email:from"><strong>[[admin:email.email_address]]</strong></label>
				<p class="help-block">
					[[admin:email.email_address_help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from" data-field="email:from" placeholder="info@example.org" /><br />
			</div>
			<div class="form-group">
				<label for="email:from_name"><strong>[[admin:email.from_name]]</strong></label>
				<p class="help-block">
					[[admin:email.from_name_help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from_name" data-field="email:from_name" placeholder="NodeBB" /><br />
			</div>
			<button class="btn btn-block btn-default" type="button" data-action="email.test">[[admin:email.send_test_email]]</button>
			<p class="help-block">
				[[admin:email.send_test_email_help]]
			</p>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">[[admin:email.email_subscriptions]]</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label for="disableEmailSubscriptions">
					<input type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" />[[admin:email.disable_subscriber_notification_emails]]</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->