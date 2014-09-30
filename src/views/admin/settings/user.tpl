<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">User List</div>
	<div class="panel-body">
		<form role="form">
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowRegistration" checked> <strong>Allow registration</strong>
				</label>
			</div>
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
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Avatars</div>
	<div class="panel-body">
		<form>
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
				<input id="customGravatarDefaultImage" type="text" class="form-control" placeholder="A custom image to use instead of gravatar defaults" data-field="customGravatarDefaultImage" /><br />
				<input data-action="upload" data-target="customGravatarDefaultImage" data-route="{relative_path}/admin/uploadgravatardefault" type="button" class="btn btn-default" value="Upload"></input>
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

<div class="panel panel-default">
	<div class="panel-heading">Account Protection</div>
	<div class="panel-body">
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
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">User Bans</div>
	<div class="panel-body">
		<form>
			<div class="form-group">
				<label>Number of flags to ban user</label>
				<input type="text" class="form-control" value="3" placeholder="" data-field="flagsForBan" />
			</div>
			<hr />
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="autoban:downvote"> <strong>Enable automatic banning for reaching below a reputation threshold</strong>
				</label>
			</div>
			<label>Reputation threshold before receiving an automatic ban</label>
			<input type="text" class="form-control" value="" placeholder="-50" data-field="autoban:downvote:threshold" />
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">User Registration</div>
	<div class="panel-body">
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
				<label>Maximum Signature Length</label>
				<input type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
			<div class="form-group">
				<label>Forum Terms of Use <small>(Leave blank to disable)</small></label>
				<textarea class="form-control" data-field="termsOfUse"></textarea>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->