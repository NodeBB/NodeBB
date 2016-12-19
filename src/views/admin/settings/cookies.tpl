<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/cookies:eu-consent]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input type="checkbox" class="mdl-switch__input" id="cookieConsentEnabled" data-field="cookieConsentEnabled">
						<span class="mdl-switch__label"><strong>[[admin/settings/cookies:consent.enabled]]</strong></span>
					</label>
				</div>
			</div>
			<div class="form-group">
				<label for="cookieConsentMessage">[[admin/settings/cookies:consent.message]]</label>
				<input class="form-control" id="cookieConsentMessage" type="text" data-field="cookieConsentMessage" />
				<p class="help-block">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
			<div class="form-group">
				<label for="cookieConsentDismiss">[[admin/settings/cookies:consent.acceptance]]</label>
				<input class="form-control" id="cookieConsentDismiss" type="text" data-field="cookieConsentDismiss" />
				<p class="help-block">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
			<div class="form-group">
				<label for="cookieConsentLink">[[admin/settings/cookies:consent.link-text]]</label>
				<input class="form-control" id="cookieConsentLink" type="text" data-field="cookieConsentLink" />
				<p class="help-block">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="cookieDomain">[[admin/settings/cookies:cookie-domain]]</label>
				<input class="form-control" id="cookieDomain" type="text" placeholder=".domain.tld" data-field="cookieDomain" /><br />
				<p class="help-block">
					[[admin/settings/cookies:blank-default]]
				</p>
			</div>

			<div class="form-group">
				<button id="delete-all-sessions" class="btn btn-danger">Revoke All Sessions</button>
				<p class="help-block">
					This will delete all sessions, you will be logged out and will have to login again!
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
