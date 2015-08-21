<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Post Sorting</div>
	<div class="col-xs-10">
		<form>
			<div class="form-group">
				<label>Default Post Sorting</label>
				<select class="form-control" data-field="topicPostSort">
					<option value="oldest_to_newest">Oldest to Newest</option>
					<option value="newest_to_oldest">Newest to Oldest</option>
					<option value="most_votes">Most Votes</option>
				</select>
			</div>
			<div class="form-group">
				<label>Default Topic Sorting</label>
				<select class="form-control" data-field="categoryTopicSort">
					<option value="newest_to_oldest">Newest to Oldest</option>
					<option value="oldest_to_newest">Oldest to Newest</option>
					<option value="most_posts">Most Posts</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Posting Restrictions</div>
	<div class="col-xs-10">
		<form>
			<div class="form-group">
				<label>Seconds between Posts</label>
				<input type="text" class="form-control" value="10" data-field="postDelay">
			</div>
			<div class="form-group">
				<label>Seconds between Posts for New Users</label>
				<input type="text" class="form-control" value="120" data-field="newbiePostDelay">
			</div>
			<div class="form-group">
				<label>Reputation threshold before this restriction is lifted</label>
				<input type="text" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>
			<div class="form-group">
				<label>Seconds before new user can post</label>
				<input type="text" class="form-control" value="10" data-field="initialPostDelay">
			</div>
			<div class="form-group">
				<label>Number of seconds users are allowed to edit posts after posting. (0 disabled)</label>
				<input type="text" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="form-group">
				<label>Minimum Title Length</label>
				<input type="text" class="form-control" value="3" data-field="minimumTitleLength">
			</div>
			<div class="form-group">
				<label>Maximum Title Length</label>
				<input type="text" class="form-control" value="255" data-field="maximumTitleLength">
			</div>
			<div class="form-group">
				<label>Minimum Post Length</label>
				<input type="text" class="form-control" value="8" data-field="minimumPostLength">
			</div>
			<div class="form-group">
				<label>Maximum Post Length</label>
				<input type="text" class="form-control" value="32767" data-field="maximumPostLength">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Teaser Settings</div>
	<div class="col-xs-10">
		<form>
			<div class="form-group">
				<label>Teaser Post</label>
				<select class="form-control" data-field="teaserPost">
					<option value="last">Last</option>
					<option value="first">First</option>
				</select>
			</div>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-xs-2 settings-header">Signature Settings</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableSignatures">
					<span class="mdl-switch__label"><strong>Disable signatures</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableLinks">
					<span class="mdl-switch__label"><strong>Disable links in signatures</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableImages">
					<span class="mdl-switch__label"><strong>Disable images in signatures</strong></span>
				</label>
			</div>
			<div class="form-group">
				<label>Maximum Signature Length</label>
				<input type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Chat Settings</div>
	<div class="col-xs-10">
		<form>
			<strong>Chat Message Inbox Size</strong><br /> <input type="text" class="form-control" value="250" data-field="chatMessageInboxSize">
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Upload Settings</div>
	<div class="col-xs-10">
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
			<strong>Maximum File Size</strong><br /> <input type="text" class="form-control" value="2048" data-field="maximumFileSize"><br />

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowTopicsThumbnail">
					<span class="mdl-switch__label"><strong>Allow users to upload topic thumbnails</strong></span>
				</label>
			</div>
			<strong>Topic Thumb Size</strong><br /> <input type="text" class="form-control" value="120" data-field="topicThumbSize"> <br />

			<strong>Allowed file types, (ie png, pdf, zip). Leave empty to allow all.</strong><br /> <input type="text" class="form-control" value="" data-field="allowedFileExtensions"><br />

		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Composer Settings</div>
	<div class="col-xs-10">
		<form>
			<p>
				The following settings govern the functionality and/or appearance of the post composer shown
				to users when they create new topics, or reply to existing topics.
			</p>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:showHelpTab">
					<input class="mdl-switch__input" type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
					<span class="mdl-switch__label">Show "Help" tab</span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:allowPluginHelp">
					<input class="mdl-switch__input" type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
					<span class="mdl-switch__label">Allow plugins to add content to the help tab</span>
				</label>
			</div>
			<div class="form-group">
				<label for="composer:customHelpText">Custom Help Text</label>
				<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">IP Tracking</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="trackIpPerPost">
					<span class="mdl-switch__label"><strong>Track IP Address for each post</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>
<!-- IMPORT admin/settings/footer.tpl -->