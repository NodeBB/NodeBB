<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:authentication]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="requireEmailConfirmation">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:require-email-confirmation]]</strong></span>
				</label>
			</div>

			<div class="form-group form-inline">
				<label for="emailConfirmInterval">[[admin/settings/user:email-confirm-interval]]</label>
				<input class="form-control" data-field="emailConfirmInterval" type="number" id="emailConfirmInterval" placeholder="Default: 10"
					value="10" />
				<label for="emailConfirmInterval">[[admin/settings/user:email-confirm-email2]]</label>
			</div>

			<div class="form-group">
				<label>[[admin/settings/user:allow-login-with]]</label>
				<select class="form-control" data-field="allowLoginWith">
					<option value="username-email">[[admin/settings/user:allow-login-with.username-email]]</option>
					<option value="username">[[admin/settings/user:allow-login-with.username]]</option>
					<option value="email">[[admin/settings/user:allow-login-with.email]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:account-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="gdpr_enabled">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:gdpr_enabled]]</strong></span>
				</label>
				<p class="help-block">[[admin/settings/user:gdpr_enabled_help]]</p>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="username:disableEdit">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:disable-username-changes]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="email:disableEdit">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:disable-email-changes]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="password:disableEdit">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:disable-password-changes]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowAccountDelete" checked>
					<span class="mdl-switch__label"><strong>[[admin/settings/user:allow-account-deletion]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="hideFullname">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:hide-fullname]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="hideEmail">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:hide-email]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:themes]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableCustomUserSkins">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:disable-user-skins]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:account-protection]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="adminReloginDuration">[[admin/settings/user:admin-relogin-duration]]</label>
				<input id="adminReloginDuration" type="text" class="form-control" data-field="adminReloginDuration" placeholder="60" />
				<p class="help-block">
					[[admin/settings/user:admin-relogin-duration-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="loginAttempts">[[admin/settings/user:login-attempts]]</label>
				<input id="loginAttempts" type="text" class="form-control" data-field="loginAttempts" placeholder="5" />
				<p class="help-block">
					[[admin/settings/user:login-attempts-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="lockoutDuration">[[admin/settings/user:lockout-duration]]</label>
				<input id="lockoutDuration" type="text" class="form-control" data-field="lockoutDuration" placeholder="60" />
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:password-expiry-days]]</label>
				<input type="text" class="form-control" data-field="passwordExpiryDays" placeholder="0" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		[[admin/settings/user:session-time]]
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="row">
				<div class="col-sm-6">
					<div class="form-group">
						<label>[[admin/settings/user:session-time-days]]</label>
						<input type="text" class="form-control" data-field="loginDays" placeholder="[[admin/settings/user:session-time-days]]" />
					</div>
				</div>
				<div class="col-sm-6">
					<div class="form-group">
						<label>[[admin/settings/user:session-time-seconds]]</label>
						<input type="text" class="form-control" data-field="loginSeconds" placeholder="[[admin/settings/user:session-time-seconds]]" />
					</div>
				</div>
				<div class="col-xs-12">
					<p class="help-block">
						[[admin/settings/user:session-time-help]]
					</p>
				</div>
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:online-cutoff]]</label>
				<input type="text" class="form-control" data-field="onlineCutoff">
				<p class="help-block">[[admin/settings/user:online-cutoff-help]]</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:registration]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin/settings/user:registration-type]]</label>
				<select class="form-control" data-field="registrationType">
					<option value="normal">[[admin/settings/user:registration-type.normal]]</option>
					<option value="admin-approval">[[admin/settings/user:registration-type.admin-approval]]</option>
					<option value="admin-approval-ip">[[admin/settings/user:registration-type.admin-approval-ip]]</option>
					<option value="invite-only">[[admin/settings/user:registration-type.invite-only]]</option>
					<option value="admin-invite-only">[[admin/settings/user:registration-type.admin-invite-only]]</option>
					<option value="disabled">[[admin/settings/user:registration-type.disabled]]</option>
				</select>
				<p class="help-block">
					[[admin/settings/user:registration-type.help, {config.relative_path}]]
				</p>
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:max-invites]]</label>
				<input type="number" class="form-control" data-field="maximumInvites" placeholder="0">
				<p class="help-block">
					[[admin/settings/user:max-invites-help]]
				</p>
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:invite-expiration]]</label>
				<input type="number" class="form-control" data-field="inviteExpiration" placeholder="7">
				<p class="help-block">
					[[admin/settings/user:invite-expiration-help]]
				</p>
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:min-username-length]]</label>
				<input type="text" class="form-control" value="2" data-field="minimumUsernameLength">
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:max-username-length]]</label>
				<input type="text" class="form-control" value="16" data-field="maximumUsernameLength">
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:min-password-length]]</label>
				<input type="text" class="form-control" value="6" data-field="minimumPasswordLength">
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:min-password-strength]]</label>
				<select class="form-control" data-field="minimumPasswordStrength">
					<option value="0">0 - too guessable: risky password</option>
					<option value="1">1 - very guessable</option>
					<option value="2">2 - somewhat guessable</option>
					<option value="3">3 - safely unguessable</option>
					<option value="4">4 - very unguessable</option>
				</select>
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:max-about-me-length]]</label>
				<input type="text" class="form-control" value="500" data-field="maximumAboutMeLength">
			</div>
			<div class="form-group">
				<label>[[admin/settings/user:terms-of-use]]</label>
				<textarea class="form-control" data-field="termsOfUse"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:user-search]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin/settings/user:user-search-results-per-page]]</label>
				<input type="text" class="form-control" value="24" data-field="userSearchResultsPerPage">
			</div>

		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/user:default-user-settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="showemail">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:show-email]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="showfullname">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:show-fullname]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="restrictChat">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:restrict-chat]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="openOutgoingLinksInNewTab">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:outgoing-new-tab]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="topicSearchEnabled">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:topic-search]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin/settings/user:digest-freq]]</label>
				<select class="form-control" data-field="dailyDigestFreq">
					<option value="off">[[admin/settings/user:digest-freq.off]]</option>
					<option value="day">[[admin/settings/user:digest-freq.daily]]</option>
					<option value="week">[[admin/settings/user:digest-freq.weekly]]</option>
					<option value="month">[[admin/settings/user:digest-freq.monthly]]</option>
				</select>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="followTopicsOnCreate">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:follow-created-topics]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="followTopicsOnReply">
					<span class="mdl-switch__label"><strong>[[admin/settings/user:follow-replied-topics]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin/settings/user:categoryWatchState]]</label>
				<select class="form-control" data-field="categoryWatchState">
					<option value="watching">[[admin/settings/user:categoryWatchState.watching]]</option>
					<option value="notwatching">[[admin/settings/user:categoryWatchState.notwatching]]</option>
					<option value="ignoring">[[admin/settings/user:categoryWatchState.ignoring]]</option>
				</select>
			</div>

			<label>[[admin/settings/user:default-notification-settings]]</label>

			<!-- BEGIN notificationSettings -->
			<div class="row">
				<div class="form-group col-xs-7">
					<label>{notificationSettings.label}</label>
				</div>
				<div class="form-group col-xs-5">
					<select class="form-control" data-field="{notificationSettings.name}">
						<option value="none">[[notifications:none]]</option>
						<option value="notification">[[notifications:notification_only]]</option>
						<option value="email">[[notifications:email_only]]</option>
						<option value="notificationemail">[[notifications:notification_and_email]]</option>
					</select>
				</div>
			</div>
			<!-- END notificationSettings -->

		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->