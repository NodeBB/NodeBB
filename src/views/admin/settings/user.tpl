<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">User List</div>
	<div class="col-xs-10">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowLocalLogin" checked> <strong>Allow local login</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowAccountDelete" checked> <strong>Allow account deletion</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="privateUserInfo"> <strong>Make user info private</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="requireEmailConfirmation"> <strong>Require Email Confirmation</strong>
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
	<div class="col-xs-2 settings-header">Avatars</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowProfileImageUploads"> <strong>Allow users to upload profile images</strong>
				</label>
			</div>

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="profile:convertProfileImageToPNG"> <strong>Convert profile image uploads to PNG</strong>
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
	<div class="col-xs-2 settings-header">Account Protection</div>
	<div class="col-xs-10">
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
	<div class="col-xs-2 settings-header">User Registration</div>
	<div class="col-xs-10">
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
	<div class="col-xs-2 settings-header">User Search</div>
	<div class="col-xs-10">
		<form>
			<div class="form-group">
				<label>Number of results to display</label>
				<input type="text" class="form-control" value="24" data-field="userSearchResultsPerPage">
			</div>

		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->