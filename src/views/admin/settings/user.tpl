<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Authentication</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowLocalLogin" checked>
					<span class="mdl-switch__label"><strong>Allow local login</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="requireEmailConfirmation">
					<span class="mdl-switch__label"><strong>Require Email Confirmation</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>Allow login with</label>
				<select class="form-control" data-field="allowLoginWith">
					<option value="username-email">Username or Email</option>
					<option value="username">Username Only</option>
					<option value="email">Email Only</option>
				</select>
			</div>

			<div class="form-group">
				<label>Registration Type</label>
				<select class="form-control" data-field="registrationType">
					<option value="normal">Normal</option>
					<option value="admin-approval">Admin Approval</option>
					<option value="invite-only">Invite Only</option>
					<option value="disabled">No registration</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Account Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="username:disableEdit">
					<span class="mdl-switch__label"><strong>Disable username changes</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowAccountDelete" checked>
					<span class="mdl-switch__label"><strong>Allow account deletion</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateUserInfo">
					<span class="mdl-switch__label"><strong>Make user info private</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Avatars</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowProfileImageUploads">
					<span class="mdl-switch__label"><strong>Allow users to upload profile images</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="profile:convertProfileImageToPNG">
					<span class="mdl-switch__label"><strong>Convert profile image uploads to PNG</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>Default Gravatar Image</label>
				<select class="form-control" data-field="defaultGravatarImage">
					<option value="">default</option>
					<option value="identicon">identicon</option>
					<option value="mm">mystery-man</option>
					<option value="monsterid">monsterid</option>
					<option value="wavatar">wavatar</option>
					<option value="retro">retro</option>
				</select>
			</div>

			<div class="form-group">
				<label>Custom Gravatar Default Image</label>
				<div class="input-group">
					<input id="customGravatarDefaultImage" type="text" class="form-control" placeholder="A custom image to use instead of gravatar defaults" data-field="customGravatarDefaultImage" />
					<span class="input-group-btn">
						<input data-action="upload" data-target="customGravatarDefaultImage" data-route="{config.relative_path}/api/admin/uploadgravatardefault" type="button" class="btn btn-default" value="Upload"></input>
					</span>
				</div>
			</div>

			<div class="form-group">
				<label for="profileImageDimension">Profile Image Dimension</label>
				<input id="profileImageDimension" type="text" class="form-control" data-field="profileImageDimension" placeholder="128" />
			</div>

			<div class="form-group">
				<label>Maximum User Image File Size</label>
				<input type="text" class="form-control" placeholder="Maximum size of uploaded user images in kilobytes" data-field="maximumProfileImageSize" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Profile Cover Image</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<label for="profile:defaultCovers"><strong>Default Cover Images</strong></label>
			<p class="help-block">
				Add comma-separated default cover images for accounts that don't have an uploaded cover image
			</p>
			<input type="text" class="form-control input-lg" id="profile:defaultCovers" data-field="profile:defaultCovers" value="{config.relative_path}/images/cover-default.png" placeholder="https://example.com/group1.png, https://example.com/group2.png" />
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Themes</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableCustomUserSkins">
					<span class="mdl-switch__label"><strong>Prevent users from choosing a custom skin</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Account Protection</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="loginAttempts">Login attempts per hour</label>
				<input id="loginAttempts" type="text" class="form-control" data-field="loginAttempts" placeholder="5" />
				<p class="help-block">
					If login attempts to a user&apos;s account exceeds this threshold, that account will be locked for a pre-configured amount of time
				</p>
			</div>
			<div class="form-group">
				<label for="lockoutDuration">Account Lockout Duration (minutes)</label>
				<input id="lockoutDuration" type="text" class="form-control" data-field="lockoutDuration" placeholder="60" />
			</div>
			<div class="form-group">
				<label>Days to remember user login sessions</label>
				<input type="text" class="form-control" data-field="loginDays" placeholder="14" />
			</div>
			<div class="form-group">
				<label>Force password reset after a set number of days</label>
				<input type="text" class="form-control" data-field="passwordExpiryDays" placeholder="0" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">User Registration</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>Minimum Username Length</label>
				<input type="text" class="form-control" value="2" data-field="minimumUsernameLength">
			</div>
			<div class="form-group">
				<label>Maximum Username Length</label>
				<input type="text" class="form-control" value="16" data-field="maximumUsernameLength">
			</div>
			<div class="form-group">
				<label>Minimum Password Length</label>
				<input type="text" class="form-control" value="6" data-field="minimumPasswordLength">
			</div>
			<div class="form-group">
				<label>Maximum About Me Length</label>
				<input type="text" class="form-control" value="500" data-field="maximumAboutMeLength">
			</div>
			<div class="form-group">
				<label>Forum Terms of Use <small>(Leave blank to disable)</small></label>
				<textarea class="form-control" data-field="termsOfUse"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">User Search</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>Number of results to display</label>
				<input type="text" class="form-control" value="24" data-field="userSearchResultsPerPage">
			</div>

		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Default User Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="openOutgoingLinksInNewTab">
					<span class="mdl-switch__label"><strong>[[user:open_links_in_new_tab]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="topicSearchEnabled">
					<span class="mdl-switch__label"><strong>[[user:enable_topic_searching]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[user:digest_label]]</label>
				<select class="form-control" data-field="dailyDigestFreq">
					<option value="off">Off</option>
					<option value="day">Daily</option>
					<option value="week">Weekly</option>
					<option value="month">Monthly</option>
				</select>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="sendChatNotifications">
					<span class="mdl-switch__label"><strong>[[user:send_chat_notifications]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="sendPostNotifications">
					<span class="mdl-switch__label"><strong>[[user:send_post_notifications]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="followTopicsOnCreate">
					<span class="mdl-switch__label"><strong>[[user:follow_topics_you_create]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="followTopicsOnReply">
					<span class="mdl-switch__label"><strong>[[user:follow_topics_you_reply_to]]</strong></span>
				</label>
			</div>

		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->