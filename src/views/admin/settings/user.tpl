<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.authentication]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowLocalLogin" checked>
					<span class="mdl-switch__label"><strong>[[admin:user.allow_local_login]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="requireEmailConfirmation">
					<span class="mdl-switch__label"><strong>[[admin:user.require_email_confirmation]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin:user.allow_login_with]]</label>
				<select class="form-control" data-field="allowLoginWith">
					<option value="username-email">[[admin:user.username_or_email]]</option>
					<option value="username">[[admin:user.username_only]]</option>
					<option value="email">[[admin:user.email_only]]</option>
				</select>
			</div>

			<div class="form-group">
				<label>[[admin:user.registration_type]]</label>
				<select class="form-control" data-field="registrationType">
					<option value="normal">[[admin:user.normal]]</option>
					<option value="admin-approval">[[admin:user.admin_approval]]</option>
					<option value="invite-only">[[admin:user.invite_only]]</option>
					<option value="disabled">[[admin:user.no_registration]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.account_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowAccountDelete" checked>
					<span class="mdl-switch__label"><strong>[[admin:user.allow_account_deletion]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateUserInfo">
					<span class="mdl-switch__label"><strong>[[admin:user.make_user_info_private]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.avatars]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowProfileImageUploads">
					<span class="mdl-switch__label"><strong>[[admin:user.allow_users_to_upload_profile_images]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="profile:convertProfileImageToPNG">
					<span class="mdl-switch__label"><strong>[[admin:user.convert_profile_image_uploads_to_png]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin:user.default_gravatar_image]]</label>
				<select class="form-control" data-field="defaultGravatarImage">
					<option value="">[[admin:user.default]]</option>
					<option value="identicon">[[admin:user.identicon]]</option>
					<option value="mm">[[admin:user.mystery_man]]</option>
					<option value="monsterid">[[admin:user.monsterid]]</option>
					<option value="wavatar">[[admin:user.wavatar]]</option>
					<option value="retro">[[admin:user.retro]]</option>
				</select>
			</div>

			<div class="form-group">
				<label>[[admin:user.custom_gravatar_default_image]]</label>
				<div class="input-group">
					<input id="customGravatarDefaultImage" type="text" class="form-control" placeholder="[[admin:user.custom_gravatar_default_image.placeholder]]" data-field="customGravatarDefaultImage" />
					<span class="input-group-btn">
						<input data-action="upload" data-target="customGravatarDefaultImage" data-route="{config.relative_path}/api/admin/uploadgravatardefault" type="button" class="btn btn-default" value="[[admin:user.upload]]"></input>
					</span>
				</div>
			</div>

			<div class="form-group">
				<label for="profileImageDimension">[[admin:user.profile_image_dimension]]</label>
				<input id="profileImageDimension" type="text" class="form-control" data-field="profileImageDimension" placeholder="128" />
			</div>

			<div class="form-group">
				<label>[[admin:user.maximum_user_image_file_size]]</label>
				<input type="text" class="form-control" placeholder="[[admin:user.maximum_user_image_file_size.placeholder]]" data-field="maximumProfileImageSize" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.themes]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableCustomUserSkins">
					<span class="mdl-switch__label"><strong>[[admin:user.prevent_users_from_choosing_a_custom_skin]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.account_protection]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="loginAttempts">[[admin:user.login_attempts_per_hour]]</label>
				<input id="loginAttempts" type="text" class="form-control" data-field="loginAttempts" placeholder="5" />
				<p class="help-block">
					[[admin:user.login_attempts_per_hour.help]]
				</p>
			</div>
			<div class="form-group">
				<label for="lockoutDuration">[[admin:user.account_lockout_duration_minutes]]</label>
				<input id="lockoutDuration" type="text" class="form-control" data-field="lockoutDuration" placeholder="60" />
			</div>
			<div class="form-group">
				<label>[[admin:user.days_to_remember_user_login_sessions]]</label>
				<input type="text" class="form-control" data-field="loginDays" placeholder="14" />
			</div>
			<div class="form-group">
				<label>[[admin:user.force_password_reset_after_a_set_number_of_days]]</label>
				<input type="text" class="form-control" data-field="passwordExpiryDays" placeholder="0" />
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.user_registration]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin:user.minimum_username_length]]</label>
				<input type="text" class="form-control" value="2" data-field="minimumUsernameLength">
			</div>
			<div class="form-group">
				<label>[[admin:user.maximum_username_length]]</label>
				<input type="text" class="form-control" value="16" data-field="maximumUsernameLength">
			</div>
			<div class="form-group">
				<label>[[admin:user.minimum_password_length]]</label>
				<input type="text" class="form-control" value="6" data-field="minimumPasswordLength">
			</div>
			<div class="form-group">
				<label>[[admin:user.maximum_about_me_length]]</label>
				<input type="text" class="form-control" value="500" data-field="maximumAboutMeLength">
			</div>
			<div class="form-group">
				<label>[[admin:user.forum_terms_of_use]]<small>[[admin:user.leave_blank_to_disable]]</small></label>
				<textarea class="form-control" data-field="termsOfUse"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:user.user_search]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin:user.number_of_results_to_display]]</label>
				<input type="text" class="form-control" value="24" data-field="userSearchResultsPerPage">
			</div>

		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->