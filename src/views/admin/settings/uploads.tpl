<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		Posts
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowFileUploads">
					<span class="mdl-switch__label"><strong>Allow users to upload regular files</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateUploads">
					<span class="mdl-switch__label"><strong>Make uploaded files private</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowGuestUploads">
					<span class="mdl-switch__label"><strong>Allow Guests to Upload Files</strong></span>
				</label>
			</div>
			
			<div class="form-group">
				<label for="maximumImageWidth">Resize images down to specified width (in pixels)</label>
				<input type="text" class="form-control" value="760" data-field="maximumImageWidth" placeholder="760">
				<p class="help-block">
					(in pixels, default: 760 pixels, set to 0 to disable)
				</p>
			</div>

			<div class="form-group">
				<label for="maximumFileSize">Maximum File Size (in KiB)</label>
				<input type="text" class="form-control" value="2048" data-field="maximumFileSize">
				<p class="help-block">
					(in kilobytes, default: 2048 KiB)
				</p>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowTopicsThumbnail">
					<span class="mdl-switch__label"><strong>Allow users to upload topic thumbnails</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label for="topicThumbSize">Topic Thumb Size</label>
				<input type="text" class="form-control" value="120" data-field="topicThumbSize"> 
			</div>

			<div class="form-group">
				<label for="allowedFileExtensions">Allowed File Extensions</label>
				<input type="text" class="form-control" value="" data-field="allowedFileExtensions" />
				<p class="help-block">
					Enter comma-separated list of file extensions here (e.g. <code>pdf,xls,doc</code>).
					An empty list means all extensions are allowed.
				</p>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		Profile Avatars
	</div>
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
				<label>Custom Default Avatar</label>
				<div class="input-group">
					<input id="defaultAvatar" type="text" class="form-control" placeholder="A custom image to use instead of user icons" data-field="defaultAvatar" />
					<span class="input-group-btn">
						<input data-action="upload" data-target="defaultAvatar" data-route="{config.relative_path}/api/admin/uploadDefaultAvatar" type="button" class="btn btn-default" value="Upload"></input>
					</span>
				</div>
			</div>

			<div class="form-group">
				<label for="profileImageDimension">Profile Image Dimension</label>
				<input id="profileImageDimension" type="text" class="form-control" data-field="profileImageDimension" placeholder="128" />
				<p class="help-block">
					(in pixels, default: 128 pixels)
				</p>
			</div>

			<div class="form-group">
				<label>Maximum Profile Image File Size</label>
				<input type="text" class="form-control" placeholder="Maximum size of uploaded user images in kilobytes" data-field="maximumProfileImageSize" />
				<p class="help-block">
					(in kilobytes, default: 256 KiB)
				</p>
			</div>

			<div class="form-group">
				<label>Maximum Cover Image File Size</label>
				<input type="text" class="form-control" placeholder="Maximum size of uploaded cover images in kilobytes" data-field="maximumCoverImageSize" />
				<p class="help-block">
					(in kilobytes, default: 2,048 KiB)
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Profile Covers</div>
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

<!-- IMPORT admin/settings/footer.tpl -->