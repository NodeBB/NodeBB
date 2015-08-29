<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.post_sorting]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin:post.default_post_sorting]]</label>
				<select class="form-control" data-field="topicPostSort">
					<option value="oldest_to_newest">[[admin:post.oldest_to_newest]]</option>
					<option value="newest_to_oldest">[[admin:post.newest_to_oldest]]</option>
					<option value="most_votes">[[admin:post.most_votes]]</option>
				</select>
			</div>
			<div class="form-group">
				<label>[[admin:post.default_topic_sorting]]</label>
				<select class="form-control" data-field="categoryTopicSort">
					<option value="newest_to_oldest">[[admin:post.newest_to_oldest]]</option>
					<option value="oldest_to_newest">[[admin:post.oldest_to_newest]]</option>
					<option value="most_posts">[[admin:post.most_posts]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.posting_restrictions]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin:post.seconds_between_posts]]</label>
				<input type="text" class="form-control" value="10" data-field="postDelay">
			</div>
			<div class="form-group">
				<label>[[admin:post.seconds_between_posts_for_new_users]]</label>
				<input type="text" class="form-control" value="120" data-field="newbiePostDelay">
			</div>
			<div class="form-group">
				<label>[[admin:post.reputation_threshold_before_this_restriction_is_lifted]]</label>
				<input type="text" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>
			<div class="form-group">
				<label>[[admin:post.seconds_before_new_user_can_post]]</label>
				<input type="text" class="form-control" value="10" data-field="initialPostDelay">
			</div>
			<div class="form-group">
				<label>Number of seconds users are allowed to edit posts after posting. (0 disabled)</label>
				<input type="text" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="form-group">
				<label>[[admin:post.minimum_title_length]]</label>
				<input type="text" class="form-control" value="3" data-field="minimumTitleLength">
			</div>
			<div class="form-group">
				<label>[[admin:post.maximum_title_length]]</label>
				<input type="text" class="form-control" value="255" data-field="maximumTitleLength">
			</div>
			<div class="form-group">
				<label>[[admin:post.minimum_post_length]]</label>
				<input type="text" class="form-control" value="8" data-field="minimumPostLength">
			</div>
			<div class="form-group">
				<label>[[admin:post.maximum_post_length]]</label>
				<input type="text" class="form-control" value="32767" data-field="maximumPostLength">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.teaser_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin:post.teaser_post]]</label>
				<select class="form-control" data-field="teaserPost">
					<option value="last">[[admin:post.last]]</option>
					<option value="first">[[admin:post.first]]</option>
				</select>
			</div>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.signature_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableSignatures">
					<span class="mdl-switch__label"><strong>[[admin:post.disable_signatures]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableLinks">
					<span class="mdl-switch__label"><strong>[[admin:post.disable_links_in_signatures]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableImages">
					<span class="mdl-switch__label"><strong>[[admin:post.disable_images_in_signatures]]</strong></span>
				</label>
			</div>
			<div class="form-group">
				<label>[[admin:post.maximum_signature_length]]</label>
				<input type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.chat_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin:post.chat_message_inbox_size]]</strong><br /> <input type="text" class="form-control" value="250" data-field="chatMessageInboxSize">
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.upload_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowFileUploads">
					<span class="mdl-switch__label"><strong>[[admin:post.allow_users_to_upload_regular_files]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateUploads">
					<span class="mdl-switch__label"><strong>[[admin:post.make_uploaded_files_private]]</strong></span>
				</label>
			</div>
			<strong>[[admin:post.maximum_file_size]]</strong><br /> <input type="text" class="form-control" value="2048" data-field="maximumFileSize"><br />

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowTopicsThumbnail">
					<span class="mdl-switch__label"><strong>[[admin:post.allow_users_to_upload_topic_thumbnails]]</strong></span>
				</label>
			</div>
			<strong>[[admin:post.topic_thumb_size]]</strong><br /> <input type="text" class="form-control" value="120" data-field="topicThumbSize"> <br />

			<strong>[[admin:post.allowed_file_types]]</strong><br /> <input type="text" class="form-control" value="" data-field="allowedFileExtensions"><br />

		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.composer_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<p>
				[[admin:post.composer_settings_help]]
			</p>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:showHelpTab">
					<input class="mdl-switch__input" type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
					<span class="mdl-switch__label">[[admin:post.show_help_tab]]</span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:allowPluginHelp">
					<input class="mdl-switch__input" type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
					<span class="mdl-switch__label">[[admin:post.allow_plugins_to_add_content_to_the_help_tab]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="composer:customHelpText">[[admin:post.custom_help_text]]</label>
				<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:post.ip_tracking]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="trackIpPerPost">
					<span class="mdl-switch__label"><strong>[[admin:post.track_ip_address_for_each_post]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>
<!-- IMPORT admin/settings/footer.tpl -->