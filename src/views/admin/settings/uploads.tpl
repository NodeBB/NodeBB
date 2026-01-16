<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="posts" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/uploads:posts]]</h5>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="stripEXIFData" data-field="stripEXIFData">
					<label for="stripEXIFData" class="form-check-label">[[admin/settings/uploads:strip-exif-data]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="privateUploads" data-field="privateUploads">
					<label for="privateUploads" class="form-check-label">[[admin/settings/uploads:private]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="privateUploadsExtensions">[[admin/settings/uploads:private-extensions]]</label>
					<input id="privateUploadsExtensions" type="text" class="form-control" value="" data-field="privateUploadsExtensions" placeholder="">
					<p class="form-text">
						[[admin/settings/uploads:private-uploads-extensions-help]]
					</p>
				</div>

				<div class="row">
					<div class="col-6">
						<div class="mb-3">
							<label class="form-label" for="resizeImageWidthThreshold">[[admin/settings/uploads:resize-image-width-threshold]]</label>
							<input id="resizeImageWidthThreshold" type="text" class="form-control" value="2000" data-field="resizeImageWidthThreshold" placeholder="2000">
							<p class="form-text">
								[[admin/settings/uploads:resize-image-width-threshold-help]]
							</p>
						</div>
					</div>

					<div class="col-6">
						<div class="mb-3">
							<label class="form-label" for="resizeImageWidth">[[admin/settings/uploads:resize-image-width]]</label>
							<input id="resizeImageWidth" type="text" class="form-control" value="760" data-field="resizeImageWidth" placeholder="760">
							<p class="form-text">
								[[admin/settings/uploads:resize-image-width-help]]
							</p>
						</div>
					</div>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="resizeImageKeepOriginal" data-field="resizeImageKeepOriginal">
					<label for="resizeImageKeepOriginal" class="form-check-label">[[admin/settings/uploads:resize-image-keep-original]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="resizeImageQuality">[[admin/settings/uploads:resize-image-quality]]</label>
					<input id="resizeImageQuality" type="text" class="form-control" value="60" data-field="resizeImageQuality" placeholder="60">
					<p class="form-text">
						[[admin/settings/uploads:resize-image-quality-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumFileSize">[[admin/settings/uploads:max-file-size]]</label>
					<input id="maximumFileSize" type="text" class="form-control" value="2048" data-field="maximumFileSize">
					<p class="form-text">
						[[admin/settings/uploads:max-file-size-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="rejectImageWidth">[[admin/settings/uploads:reject-image-width]]</label>
					<input id="rejectImageWidth" type="text" class="form-control" value="5000" data-field="rejectImageWidth" placeholder="5000">
					<p class="form-text">
						[[admin/settings/uploads:reject-image-width-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="rejectImageHeight">[[admin/settings/uploads:reject-image-height]]</label>
					<input id="rejectImageHeight" type="text" class="form-control" value="5000" data-field="rejectImageHeight" placeholder="5000">
					<p class="form-text">
						[[admin/settings/uploads:reject-image-height-help]]
					</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="allowTopicsThumbnail" data-field="allowTopicsThumbnail">
					<label for="allowTopicsThumbnail" class="form-check-label">[[admin/settings/uploads:allow-topic-thumbnails]]</label>
				</div>

					<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showPostUploadsAsThumbnails" data-field="showPostUploadsAsThumbnails">
					<label for="showPostUploadsAsThumbnails" class="form-check-label">[[admin/settings/uploads:show-post-uploads-as-thumbnails]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="topicThumbSize">[[admin/settings/uploads:topic-thumb-size]]</label>
					<input id="topicThumbSize" type="text" class="form-control" value="120" data-field="topicThumbSize">
				</div>

				<div class="mb-3">
					<label class="form-label" for="allowedFileExtensions">[[admin/settings/uploads:allowed-file-extensions]]</label>
					<input id="allowedFileExtensions" type="text" class="form-control" value="" data-field="allowedFileExtensions" data-field-type="tagsinput" />
					<p class="form-text">
						[[admin/settings/uploads:allowed-file-extensions-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="uploadRateLimitThreshold">[[admin/settings/uploads:upload-limit-threshold]]</label>
					<div id="uploadRateLimitThreshold" class="row">
						<div class="col-2">
							<input type="text" class="form-control" data-field="uploadRateLimitThreshold" />
						</div>
						<div class="col-4">
							<select class="form-select" data-field="uploadRateLimitCooldown">
								<option value="60">[[admin/settings/uploads:upload-limit-threshold-per-minute, 1]]</option>
								<option value="300">[[admin/settings/uploads:upload-limit-threshold-per-minutes, 5]]</option>
								<option value="900">[[admin/settings/uploads:upload-limit-threshold-per-minutes, 15]]</option>
								<option value="3600">[[admin/settings/uploads:upload-limit-threshold-per-minutes, 60]]</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<hr/>

			<div id="orphaned-files" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/uploads:orphans]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="preserveOrphanedUploads" data-field="preserveOrphanedUploads">
					<label for="preserveOrphanedUploads" class="form-check-label">[[admin/settings/uploads:preserve-orphaned-uploads]]</label>
				</div>

				<div class="row">
					<div class="col-sm-6">
						<label class="form-label" for="orphanExpiryDays">[[admin/settings/uploads:orphanExpiryDays]]</label>
						<input id="orphanExpiryDays" type="number" min="0" placeholder="0" class="form-control" data-field="orphanExpiryDays" />
						<p class="form-text">[[admin/settings/uploads:orphanExpiryDays-help]]</p>
					</div>
				</div>

			</div>

			<hr/>

			<div id="profile-avatars" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/uploads:profile-avatars]]</h5>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="allowProfileImageUploads" data-field="allowProfileImageUploads">
					<label for="allowProfileImageUploads" class="form-check-label">[[admin/settings/uploads:allow-profile-image-uploads]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="profile:convertProfileImageToPNG" data-field="profile:convertProfileImageToPNG">
					<label for="profile:convertProfileImageToPNG" class="form-check-label">[[admin/settings/uploads:convert-profile-image-png]]</label>
				</div>

				<div class="mb-3">
					<label>[[admin/settings/uploads:default-avatar]]</label>
					<div class="d-flex gap-1">
						<input id="defaultAvatar" type="text" class="form-control" placeholder="A custom image to use instead of user icons" data-field="defaultAvatar" />
						<input data-action="upload" data-target="defaultAvatar" data-route="{config.relative_path}/api/admin/uploadDefaultAvatar" type="button" class="btn btn-light" value="[[admin/settings/uploads:upload]]" />
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="profileImageDimension">[[admin/settings/uploads:profile-image-dimension]]</label>
					<input id="profileImageDimension" type="text" class="form-control" data-field="profileImageDimension" placeholder="200" />
					<p class="form-text">
						[[admin/settings/uploads:profile-image-dimension-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumProfileImageSize">[[admin/settings/uploads:max-profile-image-size]]</label>
					<input id="maximumProfileImageSize" type="text" class="form-control" placeholder="Maximum size of uploaded user images in kibibytes" data-field="maximumProfileImageSize" />
					<p class="form-text">
						[[admin/settings/uploads:max-profile-image-size-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumCoverImageSize">[[admin/settings/uploads:max-cover-image-size]]</label>
					<input id="maximumCoverImageSize" type="text" class="form-control" placeholder="Maximum size of uploaded cover images in kibibytes" data-field="maximumCoverImageSize" />
					<p class="form-text">
						[[admin/settings/uploads:max-cover-image-size-help]]
					</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="profile:keepAllUserImages" data-field="profile:keepAllUserImages">
					<label for="profile:keepAllUserImages" class="form-check-label">[[admin/settings/uploads:keep-all-user-images]]</label>
				</div>

			</div>

			<hr/>

			<div id="profile-covers" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/uploads:profile-covers]]</h5>
				<label class="form-label" for="profile:defaultCovers"><strong>[[admin/settings/uploads:default-covers]]</strong></label>
				<p class="form-text">
					[[admin/settings/uploads:default-covers-help]]
				</p>
				<input type="text" class="form-control form-control-lg" id="profile:defaultCovers" data-field="profile:defaultCovers" data-field-type="tagsinput" value="/assets/images/cover-default.png" />
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
