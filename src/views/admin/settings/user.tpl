<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="account-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:account-settings]]</h5>
				<div class="mb-3">
					<label class="form-label" for="allowLoginWith">[[admin/settings/user:allow-login-with]]</label>
					<select id="allowLoginWith" class="form-select" data-field="allowLoginWith">
						<option value="username-email">[[admin/settings/user:allow-login-with.username-email]]</option>
						<option value="username">[[admin/settings/user:allow-login-with.username]]</option>
					</select>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="gdpr_enabled" data-field="gdpr_enabled">
					<label for="gdpr_enabled" class="form-check-label">[[admin/settings/user:gdpr-enabled]]</label>
					<p class="form-text">[[admin/settings/user:gdpr-enabled-help]]</p>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="username:disableEdit" data-field="username:disableEdit">
					<label for="username:disableEdit" class="form-check-label">[[admin/settings/user:disable-username-changes]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="email:disableEdit" data-field="email:disableEdit">
					<label for="email:disableEdit" class="form-check-label">[[admin/settings/user:disable-email-changes]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="password:disableEdit" data-field="password:disableEdit">
					<label for="password:disableEdit" class="form-check-label">[[admin/settings/user:disable-password-changes]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="allowAccountDelete" data-field="allowAccountDelete" checked>
					<label for="allowAccountDelete" class="form-check-label">[[admin/settings/user:allow-account-deletion]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="hideFullname" data-field="hideFullname">
					<label for="hideFullname" class="form-check-label">[[admin/settings/user:hide-fullname]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="hideEmail" data-field="hideEmail">
					<label for="hideEmail" class="form-check-label">[[admin/settings/user:hide-email]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showFullnameAsDisplayName" data-field="showFullnameAsDisplayName">
					<label for="showFullnameAsDisplayName" class="form-check-label">[[admin/settings/user:show-fullname-as-displayname]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="disableCustomUserSkins" data-field="disableCustomUserSkins">
					<label for="disableCustomUserSkins" class="form-check-label">[[admin/settings/user:disable-user-skins]]</label>
				</div>
			</div>

			<hr/>

			<div id="account-protection" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:account-protection]]</h5>
				<div class="mb-3">
					<label class="form-label" for="adminReloginDuration">[[admin/settings/user:admin-relogin-duration]]</label>
					<input id="adminReloginDuration" type="text" class="form-control" data-field="adminReloginDuration" placeholder="60" />
					<p class="form-text">
						[[admin/settings/user:admin-relogin-duration-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="loginAttempts">[[admin/settings/user:login-attempts]]</label>
					<input id="loginAttempts" type="text" class="form-control" data-field="loginAttempts" placeholder="5" />
					<p class="form-text">
						[[admin/settings/user:login-attempts-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="lockoutDuration">[[admin/settings/user:lockout-duration]]</label>
					<input id="lockoutDuration" type="text" class="form-control" data-field="lockoutDuration" placeholder="60" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="passwordExpiryDays">[[admin/settings/user:password-expiry-days]]</label>
					<input id="passwordExpiryDays" type="text" class="form-control" data-field="passwordExpiryDays" placeholder="0" />
				</div>
			</div>

			<hr/>

			<div id="session-time" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:session-time]]</h5>
				<div class="row">
					<div class="col-sm-6">
						<div class="form-group mb-3">
							<label class="form-label" for="loginDays">[[admin/settings/user:session-time-days]]</label>
							<input id="loginDays" type="number" min="0" class="form-control" data-field="loginDays" placeholder="[[admin/settings/user:session-time-days]]" />
						</div>
					</div>
					<div class="col-sm-6">
						<div class="form-group mb-3">
							<label class="form-label" for="loginSeconds">[[admin/settings/user:session-time-seconds]]</label>
							<input id="loginSeconds" type="number" min="0" step="60" class="form-control" data-field="loginSeconds" placeholder="[[admin/settings/user:session-time-seconds]]" />
						</div>
					</div>
				</div>
				<div class="row">
					<div class="col-12">
						<p class="form-text">
							[[admin/settings/user:session-time-help]]
						</p>
					</div>
				</div>

				<div class="form-group mb-3">
					<label class="form-label" for="sessionDuration">[[admin/settings/user:session-duration]]</label>
					<input id="sessionDuration" type="number" step="60" min="0" class="form-control" data-field="sessionDuration">
					<p class="form-text">[[admin/settings/user:session-duration-help]]</p>
				</div>

				<div class="form-group mb-3">
					<label class="form-label" for="onlineCutoff">[[admin/settings/user:online-cutoff]]</label>
					<input id="onlineCutoff" type="number" min="0" class="form-control" data-field="onlineCutoff">
					<p class="form-text">[[admin/settings/user:online-cutoff-help]]</p>
				</div>
			</div>

			<hr/>

			<div id="user-registration" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:registration]]</h5>
				<div class="mb-3">
					<label class="form-label" for="registrationType">[[admin/settings/user:registration-type]]</label>
					<select id="registrationType" class="form-select" data-field="registrationType">
						<option value="normal">[[admin/settings/user:registration-type.normal]]</option>
						<option value="invite-only">[[admin/settings/user:registration-type.invite-only]]</option>
						<option value="admin-invite-only">[[admin/settings/user:registration-type.admin-invite-only]]</option>
						<option value="disabled">[[admin/settings/user:registration-type.disabled]]</option>
					</select>
					<p class="form-text">
						[[admin/settings/user:registration-type.help, {config.relative_path}]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="registrationApprovalType">[[admin/settings/user:registration-approval-type]]</label>
					<select id="registrationApprovalType" class="form-select" data-field="registrationApprovalType">
						<option value="normal">[[admin/settings/user:registration-type.normal]]</option>
						<option value="admin-approval">[[admin/settings/user:registration-type.admin-approval]]</option>
						<option value="admin-approval-ip">[[admin/settings/user:registration-type.admin-approval-ip]]</option>
					</select>
					<p class="form-text">
						[[admin/settings/user:registration-approval-type.help, {config.relative_path}]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="autoApproveTime">[[admin/settings/user:registration-queue-auto-approve-time]]</label>
					<input id="autoApproveTime" type="number" class="form-control" data-field="autoApproveTime" placeholder="0">
					<p class="form-text">
						[[admin/settings/user:registration-queue-auto-approve-time-help]]
					</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showAverageApprovalTime" data-field="showAverageApprovalTime">
					<label for="showAverageApprovalTime" class="form-check-label">[[admin/settings/user:registration-queue-show-average-time]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="requireEmailAddress" data-field="requireEmailAddress" name="requireEmailAddress" />
					<label for="requireEmailAddress" class="form-check-label">[[admin/settings/email:require-email-address]]</label>
				</div>
				<p class="form-text">[[admin/settings/email:require-email-address-warning]]</p>

				<div class="mb-3">
					<label class="form-label" for="maximumInvites">[[admin/settings/user:max-invites]]</label>
					<input id="maximumInvites" type="number" class="form-control" data-field="maximumInvites" placeholder="0">
					<p class="form-text">
						[[admin/settings/user:max-invites-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="inviteExpiration">[[admin/settings/user:invite-expiration]]</label>
					<input id="inviteExpiration" type="number" class="form-control" data-field="inviteExpiration" placeholder="7">
					<p class="form-text">
						[[admin/settings/user:invite-expiration-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="minimumUsernameLength">[[admin/settings/user:min-username-length]]</label>
					<input id="minimumUsernameLength" type="text" class="form-control" value="2" data-field="minimumUsernameLength">
				</div>
				<div class="mb-3">
					<label class="form-label" for="maximumUsernameLength">[[admin/settings/user:max-username-length]]</label>
					<input id="maximumUsernameLength" type="text" class="form-control" value="16" data-field="maximumUsernameLength">
				</div>
				<div class="mb-3">
					<label class="form-label" for="minimumPasswordLength">[[admin/settings/user:min-password-length]]</label>
					<input id="minimumPasswordLength" type="text" class="form-control" value="6" data-field="minimumPasswordLength">
				</div>
				<div class="mb-3">
					<label class="form-label" for="minimumPasswordStrength">[[admin/settings/user:min-password-strength]]</label>
					<select id="minimumPasswordStrength" class="form-select" data-field="minimumPasswordStrength">
						<option value="0">0 - too guessable: risky password</option>
						<option value="1">1 - very guessable</option>
						<option value="2">2 - somewhat guessable</option>
						<option value="3">3 - safely unguessable</option>
						<option value="4">4 - very unguessable</option>
					</select>
				</div>
				<div class="mb-3">
					<label class="form-label" for="maximumAboutMeLength">[[admin/settings/user:max-about-me-length]]</label>
					<input id="maximumAboutMeLength" type="text" class="form-control" value="500" data-field="maximumAboutMeLength">
				</div>
				<div class="mb-3">
					<label class="form-label" for="termsOfUse">[[admin/settings/user:terms-of-use]]</label>
					<textarea id="termsOfUse" class="form-control" data-field="termsOfUse"></textarea>
				</div>
			</div>

			<hr/>

			<!-- new user restrictions -->
			<div id="new-user-restrictions" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:restrictions-new]]</h5>

				<div class="mb-3">
					<label class="form-label" for="newbieReputationThreshold">[[admin/settings/user:restrictions.rep-threshold]]</label>
					<input id="newbieReputationThreshold" type="text" class="form-control" value="3" data-field="newbieReputationThreshold">
				</div>

				<div class="mb-3">
					<label class="form-label" for="newbiePostDelay">[[admin/settings/user:restrictions.seconds-between-new]]</label>
					<input id="newbiePostDelay" type="text" class="form-control" value="120" data-field="newbiePostDelay">
				</div>

				<div class="mb-3">
					<label class="form-label" for="initialPostDelay">[[admin/settings/user:restrictions.seconds-before-new]]</label>
					<input id="initialPostDelay" type="text" class="form-control" value="10" data-field="initialPostDelay">
				</div>

				<div class="mb-3">
					<label class="form-label" for="newbiePostEditDuration">[[admin/settings/user:restrictions.seconds-edit-after-new]]</label>
					<input id="newbiePostEditDuration" type="text" class="form-control" value="120" data-field="newbiePostEditDuration">
				</div>

				<div class="mb-3">
					<label class="form-label" for="newbieChatMessageDelay">[[admin/settings/user:restrictions.milliseconds-between-messages]]</label>
					<input id="newbieChatMessageDelay" type="text" class="form-control" data-field="newbieChatMessageDelay">
				</div>

				<div class="mb-3">
					<label class="form-label" for="groupsExemptFromNewUserRestrictions">[[admin/settings/user:restrictions.groups-exempt-from-new-user-restrictions]]</label>
					<select id="groupsExemptFromNewUserRestrictions" class="form-select" multiple data-field="groupsExemptFromNewUserRestrictions">
						{{{ each groupsExemptFromNewUserRestrictions }}}
						<option value="{groupsExemptFromNewUserRestrictions.displayName}">{groupsExemptFromNewUserRestrictions.displayName}</option>
						{{{ end }}}
					</select>
				</div>

			</div>

			<hr/>

			<div id="guest-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:guest-settings]]</h5>

				<div class="mb-3">
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="allowGuestHandles" data-field="allowGuestHandles">
						<label for="allowGuestHandles" class="form-check-label">[[admin/settings/user:handles.enabled]]</label>
					</div>
					<p class="form-text">
						[[admin/settings/user:handles.enabled-help]]
					</p>
				</div>
				<div class="mb-3">
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="guestsIncrementTopicViews" data-field="guestsIncrementTopicViews">
						<label for="guestsIncrementTopicViews" class="form-check-label">[[admin/settings/user:topic-views.enabled]]</label>
					</div>
				</div>
				<div class="mb-3">
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" id="allowGuestReplyNotifications" data-field="allowGuestReplyNotifications">
						<label for="allowGuestReplyNotifications" class="form-check-label">[[admin/settings/user:reply-notifications.enabled]]</label>
					</div>
				</div>
			</div>

			<hr/>

			<div id="default-user-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/user:default-user-settings]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showemail" data-field="showemail">
					<label for="showemail" class="form-check-label">[[admin/settings/user:show-email]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showfullname" data-field="showfullname">
					<label for="showfullname" class="form-check-label">[[admin/settings/user:show-fullname]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="disableIncomingChats" data-field="disableIncomingChats">
					<label for="disableIncomingChats" class="form-check-label">[[admin/settings/user:disable-incoming-chats]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="openOutgoingLinksInNewTab" data-field="openOutgoingLinksInNewTab">
					<label for="openOutgoingLinksInNewTab" class="form-check-label">[[admin/settings/user:outgoing-new-tab]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="topicSearchEnabled" data-field="topicSearchEnabled">
					<label for="topicSearchEnabled" class="form-check-label">[[admin/settings/user:topic-search]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="updateUrlWithPostIndex" data-field="updateUrlWithPostIndex">
					<label for="updateUrlWithPostIndex" class="form-check-label">[[admin/settings/user:update-url-with-post-index]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="dailyDigestFreq">[[admin/settings/user:digest-freq]]</label>
					<select id="dailyDigestFreq" class="form-select" data-field="dailyDigestFreq">
						<option value="off">[[admin/settings/user:digest-freq.off]]</option>
						<option value="day">[[admin/settings/user:digest-freq.daily]]</option>
						<option value="week">[[admin/settings/user:digest-freq.weekly]]</option>
						<option value="biweek">[[admin/settings/user:digest-freq.biweekly]]</option>
						<option value="month">[[admin/settings/user:digest-freq.monthly]]</option>
					</select>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="followTopicsOnCreate" data-field="followTopicsOnCreate">
					<label for="followTopicsOnCreate" class="form-check-label">[[admin/settings/user:follow-created-topics]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="followTopicsOnReply" data-field="followTopicsOnReply">
					<label for="followTopicsOnReply" class="form-check-label">[[admin/settings/user:follow-replied-topics]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="categoryWatchState">[[admin/settings/user:categoryWatchState]]</label>
					<select id="categoryWatchState" class="form-select" data-field="categoryWatchState">
						<option value="tracking">[[admin/settings/user:categoryWatchState.tracking]]</option>
						<option value="notwatching">[[admin/settings/user:categoryWatchState.notwatching]]</option>
						<option value="ignoring">[[admin/settings/user:categoryWatchState.ignoring]]</option>
					</select>
				</div>

				<label class="form-label mb-2">[[admin/settings/user:default-notification-settings]]</label>

				{{{ each notificationSettings }}}
				<div class="row">
					<div class="mb-3 col-7">
						<label class="form-label">{./label}</label>
					</div>
					<div class="mb-3 col-5">
						<select class="form-select" data-field="{./name}">
							<option value="none">[[notifications:none]]</option>
							<option value="notification">[[notifications:notification-only]]</option>
							<option value="email">[[notifications:email-only]]</option>
							<option value="notificationemail">[[notifications:notification-and-email]]</option>
						</select>
					</div>
				</div>
				{{{ end }}}
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
