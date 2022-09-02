<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/cookies:eu-consent]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input type="checkbox" class="mdl-switch__input" id="cookieConsentEnabled" data-field="cookieConsentEnabled">
						<span class="mdl-switch__label"><strong>[[admin/settings/cookies:consent.enabled]]</strong></span>
					</label>
				</div>
			</div>
			<div class="mb-3">
				<label class="form-label" for="cookieConsentMessage">[[admin/settings/cookies:consent.message]]</label>
				<input class="form-control" id="cookieConsentMessage" type="text" data-field="cookieConsentMessage" />
				<p class="form-text">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
			<div class="mb-3">
				<label class="form-label" for="cookieConsentDismiss">[[admin/settings/cookies:consent.acceptance]]</label>
				<input class="form-control" id="cookieConsentDismiss" type="text" data-field="cookieConsentDismiss" />
				<p class="form-text">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
			<div class="mb-3">
				<label class="form-label" for="cookieConsentLink">[[admin/settings/cookies:consent.link-text]]</label>
				<input class="form-control" id="cookieConsentLink" type="text" data-field="cookieConsentLink" />
				<p class="form-text">
					[[admin/settings/cookies:consent.blank-localised-default]]
				</p>
			</div>
			<div class="mb-3">
				<label class="form-label" for="cookieConsentLinkUrl">[[admin/settings/cookies:consent.link-url]]</label>
				<input class="form-control" id="cookieConsentLinkUrl" type="text" data-field="cookieConsentLinkUrl" />
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">Settings</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="cookieDomain">[[admin/settings/cookies:cookie-domain]]</label>
				<input class="form-control" id="cookieDomain" type="text" placeholder=".domain.tld" data-field="cookieDomain" />
				<p class="form-text">
					[[admin/settings/cookies:blank-default]]
				</p>
			</div>

			<div class="mb-3">
				<label class="form-label" for="maxUserSessions">[[admin/settings/cookies:max-user-sessions]]</label>
				<input class="form-control" id="maxUserSessions" type="number" placeholder="10" data-field="maxUserSessions" />
				<p class="form-text">
					[[admin/settings/cookies:blank-default]]
				</p>
			</div>

			<div class="mb-3">
				<button id="delete-all-sessions" class="btn btn-danger">Revoke All Sessions</button>
				<p class="form-text">
					This will delete all sessions, you will be logged out and will have to login again!
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
