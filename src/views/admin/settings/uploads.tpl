<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		[[admin/settings/uploads:posts]]
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowFileUploads">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:allow-files]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateUploads">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:private]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label for="privateUploadsExtensions">[[admin/settings/uploads:private-extensions]]</label>
				<input type="text" class="form-control" value="" data-field="privateUploadsExtensions" placeholder="">
				<p class="help-block">
					[[admin/settings/uploads:private-uploads-extensions-help]]
				</p>
			</div>

			<div class="row">
				<div class="col-xs-6">
					<div class="form-group">
						<label for="resizeImageWidthThreshold">[[admin/settings/uploads:resize-image-width-threshold]]</label>
						<input type="text" class="form-control" value="2000" data-field="resizeImageWidthThreshold" placeholder="2000">
						<p class="help-block">
							[[admin/settings/uploads:resize-image-width-threshold-help]]
						</p>
					</div>
				</div>

				<div class="col-xs-6">
					<div class="form-group">
						<label for="resizeImageWidth">[[admin/settings/uploads:resize-image-width]]</label>
						<input type="text" class="form-control" value="760" data-field="resizeImageWidth" placeholder="760">
						<p class="help-block">
							[[admin/settings/uploads:resize-image-width-help]]
						</p>
					</div>
				</div>
			</div>

			<div class="form-group">
				<label for="resizeImageQuality">[[admin/settings/uploads:resize-image-quality]]</label>
				<input type="text" class="form-control" value="60" data-field="resizeImageQuality" placeholder="60">
				<p class="help-block">
					[[admin/settings/uploads:resize-image-quality-help]]
				</p>
			</div>

			<div class="form-group">
				<label for="maximumFileSize">[[admin/settings/uploads:max-file-size]]</label>
				<input type="text" class="form-control" value="2048" data-field="maximumFileSize">
				<p class="help-block">
					[[admin/settings/uploads:max-file-size-help]]
				</p>
			</div>

			<div class="form-group">
				<label for="rejectImageWidth">[[admin/settings/uploads:reject-image-width]]</label>
				<input type="text" class="form-control" value="5000" data-field="rejectImageWidth" placeholder="5000">
				<p class="help-block">
					[[admin/settings/uploads:reject-image-width-help]]
				</p>
			</div>

			<div class="form-group">
				<label for="rejectImageHeight">[[admin/settings/uploads:reject-image-height]]</label>
				<input type="text" class="form-control" value="5000" data-field="rejectImageHeight" placeholder="5000">
				<p class="help-block">
					[[admin/settings/uploads:reject-image-height-help]]
				</p>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowTopicsThumbnail">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:allow-topic-thumbnails]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label for="topicThumbSize">[[admin/settings/uploads:topic-thumb-size]]</label>
				<input type="text" class="form-control" value="120" data-field="topicThumbSize">
			</div>

			<div class="form-group">
				<label for="allowedFileExtensions">[[admin/settings/uploads:allowed-file-extensions]]</label>
				<input type="text" class="form-control" value="" data-field="allowedFileExtensions" data-field-type="tagsinput" />
				<p class="help-block">
					[[admin/settings/uploads:allowed-file-extensions-help]]
				</p>
			</div>
		</form>
	</div>

</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">
		[[admin/settings/uploads:profile-avatars]]
	</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowProfileImageUploads">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:allow-profile-image-uploads]]</strong></span>
				</label>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="profile:convertProfileImageToPNG">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:convert-profile-image-png]]</strong></span>
				</label>
			</div>

			<div class="form-group">
				<label>[[admin/settings/uploads:default-avatar]]</label>
				<div class="input-group">
					<input id="defaultAvatar" type="text" class="form-control" placeholder="A custom image to use instead of user icons" data-field="defaultAvatar" />
					<span class="input-group-btn">
						<input data-action="upload" data-target="defaultAvatar" data-route="{config.relative_path}/api/admin/uploadDefaultAvatar" type="button" class="btn btn-default" value="[[admin/settings/uploads:upload]]"></input>
					</span>
				</div>
			</div>

			<div class="form-group">
				<label for="profileImageDimension">[[admin/settings/uploads:profile-image-dimension]]</label>
				<input id="profileImageDimension" type="text" class="form-control" data-field="profileImageDimension" placeholder="200" />
				<p class="help-block">
					[[admin/settings/uploads:profile-image-dimension-help]]
				</p>
			</div>

			<div class="form-group">
				<label>[[admin/settings/uploads:max-profile-image-size]]</label>
				<input type="text" class="form-control" placeholder="Maximum size of uploaded user images in kibibytes" data-field="maximumProfileImageSize" />
				<p class="help-block">
					[[admin/settings/uploads:max-profile-image-size-help]]
				</p>
			</div>

			<div class="form-group">
				<label>[[admin/settings/uploads:max-cover-image-size]]</label>
				<input type="text" class="form-control" placeholder="Maximum size of uploaded cover images in kibibytes" data-field="maximumCoverImageSize" />
				<p class="help-block">
					[[admin/settings/uploads:max-cover-image-size-help]]
				</p>
			</div>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="profile:keepAllUserImages">
					<span class="mdl-switch__label"><strong>[[admin/settings/uploads:keep-all-user-images]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/uploads:profile-covers]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<label for="profile:defaultCovers"><strong>[[admin/settings/uploads:default-covers]]</strong></label>
			<p class="help-block">
				[[admin/settings/uploads:default-covers-help]]
			</p>
			<input type="text" class="form-control input-lg" id="profile:defaultCovers" data-field="profile:defaultCovers" data-field-type="tagsinput" value="/assets/images/cover-default.png" placeholder="https://example.com/group1.png, https://example.com/group2.png" />
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
