<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:email.email_settings]]</div>
	<div class="col-sm-10 col-xs-12">
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
			<button class="btn btn-primary" type="button" data-action="email.test">[[admin:email.send_test_email]]</button>
			<p class="help-block">
				[[admin:email.send_test_email_help]]
			</p>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:email.email_subscriptions]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label for="disableEmailSubscriptions" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" />
					<span class="mdl-switch__label">[[admin:email.disable_subscriber_notification_emails]]</span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->
