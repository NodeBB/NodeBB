<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:email-settings]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="email:from">[[admin/settings/email:address]]</label>
				<p class="form-text">
					[[admin/settings/email:address-help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from" data-field="email:from" placeholder="info@example.org" />
			</div>

			<div class="mb-3">
				<label class="form-label" for="email:from_name">[[admin/settings/email:from]]</label>
				<p class="form-text">
					[[admin/settings/email:from-help]]
				</p>
				<input type="text" class="form-control input-lg" id="email:from_name" data-field="email:from_name" placeholder="NodeBB" />
			</div>

			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="requireEmailAddress" data-field="requireEmailAddress" name="requireEmailAddress" />
				<label for="requireEmailAddress" class="form-check-label">[[admin/settings/email:require-email-address]]</label>
			</div>
			<p class="form-text">[[admin/settings/email:require-email-address-warning]]</p>

			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="sendEmailToBanned" data-field="sendEmailToBanned" name="sendEmailToBanned" />
				<label for="sendEmailToBanned" class="form-check-label">[[admin/settings/email:sendEmailToBanned]]</label>
			</div>

			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="removeEmailNotificationImages" data-field="removeEmailNotificationImages" name="removeEmailNotificationImages" />
				<label for="removeEmailNotificationImages" class="form-check-label">[[admin/settings/email:notifications.remove-images]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:confirmation-settings]]</div>
	<div class="col-sm-10 col-12">
		<div class="row mb-3 align-items-center">
			<div class="col-auto">
				<label class="form-label" for="emailConfirmInterval">[[admin/settings/user:email-confirm-interval]]</label>
			</div>
			<div class="col-auto">
				<input class="form-control" data-field="emailConfirmInterval" type="number" id="emailConfirmInterval" placeholder="Default: 10"
				value="10" />
			</div>
			<div class="col-auto">
				<label class="form-label" for="emailConfirmInterval">[[admin/settings/user:email-confirm-interval2]]</label>
			</div>
		</div>

		<div class="mb-3">
			<label for="emailConfirmExpiry">[[admin/settings/email:confirmation.expiry]]</label>
			<input class="form-control" data-field="emailConfirmExpiry" type="number" id="emailConfirmExpiry" placeholder="24" />
		</div>

		<div class="form-check form-switch mb-3">
			<input class="form-check-input" type="checkbox" id="sendValidationEmail" data-field="sendValidationEmail" name="sendValidationEmail" />
			<label for="sendValidationEmail" class="form-check-label">[[admin/settings/email:send-validation-email]]</label>
		</div>

		<div class="form-check form-switch mb-3">
			<input class="form-check-input" type="checkbox" id="includeUnverifiedEmails" data-field="includeUnverifiedEmails" name="includeUnverifiedEmails" />
			<label for="includeUnverifiedEmails" class="form-check-label">[[admin/settings/email:include-unverified-emails]]</label>
		</div>
		<p class="form-text">[[admin/settings/email:include-unverified-warning]]</p>

		<div class="form-check form-switch mb-3">
			<input class="form-check-input" type="checkbox" id="emailPrompt" data-field="emailPrompt" name="emailPrompt" />
			<label for="emailPrompt" class="form-check-label">[[admin/settings/email:prompt]]</label>
		</div>
		<p class="form-text">[[admin/settings/email:prompt-help]]</p>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:subscriptions]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="disableEmailSubscriptions" data-field="disableEmailSubscriptions" name="disableEmailSubscriptions" />
				<label for="disableEmailSubscriptions" class="form-check-label">[[admin/settings/email:subscriptions.disable]]</label>
			</div>

			<div class="mb-3">
				<label class="form-label" for="digestHour">[[admin/settings/email:subscriptions.hour]]</label>
				<input type="number" class="form-control input-lg" id="digestHour" data-field="digestHour" placeholder="17" min="0" max="24" />
				<p class="form-text">
					[[admin/settings/email:subscriptions.hour-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:smtp-transport]]</div>
	<div class="col-sm-10 col-12">
		<div class="alert alert-warning">
			[[admin/settings/email:smtp-transport-help]]
		</div>
		<form>
			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" id="email:smtpTransport:enabled" data-field="email:smtpTransport:enabled" name="email:smtpTransport:enabled" />
				<label for="email:smtpTransport:enabled" class="form-check-label">[[admin/settings/email:smtp-transport.enabled]]</label>
			</div>
			<div class="mb-3">
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="email:smtpTransport:pool" data-field="email:smtpTransport:pool" name="email:smtpTransport:pool" />
					<label for="email:smtpTransport:pool" class="form-check-label">[[admin/settings/email:smtp-transport.pool]]</label>
				</div>
				<p class="form-text">
					[[admin/settings/email:smtp-transport.pool-help]]
				</p>
			</div>
			<div class="mb-3">
				<label class="form-label" for="email:smtpTransport:service">[[admin/settings/email:smtp-transport.service]]</label>
				<select class="form-select" id="email:smtpTransport:service" data-field="email:smtpTransport:service">
					<option value="nodebb-custom-smtp" style="font-weight: bold">[[admin/settings/email:smtp-transport.service-custom]]</option>
					<option style="font-size: 10px" disabled>&nbsp;</option>

					{{{ each services }}}
					<option value="{@value}">{@value}</option>
					{{{ end }}}
				</select>
				<p class="form-text">
					[[admin/settings/email:smtp-transport.service-help]]
					<br>
					[[admin/settings/email:smtp-transport.gmail-warning1]]
					<br>
					[[admin/settings/email:smtp-transport.gmail-warning2]]
				</p>
			</div>
			<div class="mb-3 card card-body text-bg-light border-0" id="email:smtpTransport:custom-service" style="">
				<h5>Custom Service</h5>
				<div class="mb-3">
					<label class="form-label" for="email:smtpTransport:host">[[admin/settings/email:smtp-transport.host]]</label>
					<input type="text" class="form-control input-md" id="email:smtpTransport:host" data-field="email:smtpTransport:host" placeholder="smtp.example.org">
				</div>

				<div class="mb-3">
					<label class="form-label" for="email:smtpTransport:port">[[admin/settings/email:smtp-transport.port]]</label>
					<input type="text" class="form-control input-md" id="email:smtpTransport:port" data-field="email:smtpTransport:port" placeholder="5555">
				</div>

				<div>
					<label class="form-label" for="email:smtpTransport:security">[[admin/settings/email:smtp-transport.security]]</label>
					<select class="form-select" id="email:smtpTransport:security" data-field="email:smtpTransport:security">
						<option value="ENCRYPTED">[[admin/settings/email:smtp-transport.security-encrypted]]</option>
						<option value="STARTTLS">[[admin/settings/email:smtp-transport.security-starttls]]</option>
						<option value="NONE">[[admin/settings/email:smtp-transport.security-none]]</option>
					</select>
				</div>
			</div>
			<div class="mb-3">
				<label class="form-label" for="email:smtpTransport:user">[[admin/settings/email:smtp-transport.username]]</label>
				<input id="email:smtpTransport:user" type="text" class="form-control input-lg" data-field="email:smtpTransport:user" placeholder="admin@example.org" autocomplete="off" />
				<p class="form-text">
					[[admin/settings/email:smtp-transport.username-help]]
				</p>
			</div>
			<div>
				<label class="form-label" for="email:smtpTransport:pass">[[admin/settings/email:smtp-transport.password]]</label>
				<input id="email:smtpTransport:pass" type="password" class="form-control input-lg" data-field="email:smtpTransport:pass" autocomplete="off" />
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:template]]</div>
	<div class="col-sm-10 col-12">
		<div class="mb-3">
			<label class="form-label" for="email-editor-selector">[[admin/settings/email:template.select]]</label>
			<select id="email-editor-selector" class="form-select">
				<!-- BEGIN emails -->
				<option value="{emails.path}">{emails.path}</option>
				<!-- END emails -->
			</select>
		</div>
		<div class="mb-3">
			<div id="email-editor"></div>
			<input type="hidden" id="email-editor-holder" value="" data-field="" />
		</div>

		<button class="btn btn-warning" type="button" data-action="email.revert">[[admin/settings/email:template.revert]]</button>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/email:testing]]</div>
	<div class="col-sm-10 col-12">
		<div class="mb-3">
			<label class="form-label" for="test-email">[[admin/settings/email:testing.select]]</label>
			<select id="test-email" class="form-select">
				<!-- BEGIN sendable -->
				<option value="{@value}">{@value}</option>
				<!-- END sendable -->
			</select>
		</div>
		<button class="btn btn-primary" type="button" data-action="email.test">[[admin/settings/email:testing.send]]</button>
		<p class="form-text">
			[[admin/settings/email:testing.send-help]]
		</p>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
