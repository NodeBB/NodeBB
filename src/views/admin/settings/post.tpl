<!-- IMPORT admin/settings/header.tpl -->

<div class="panel panel-default">
	<div class="panel-heading">Post Settings</div>
	<div class="panel-body">
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

			<div class="form-group">
				<label>Seconds between Posts</label>
				<input type="number" class="form-control" value="10" data-field="postDelay">
			</div>
			<div class="form-group col-sm-6">
				<label>Seconds between Posts for New Users</label>
				<input type="number" class="form-control" value="120" data-field="newbiePostDelay">
			</div>
			<div class="form-group col-sm-6">
				<label>Reputation threshold before this restriction is lifted</label>
				<input type="number" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>
			<div class="form-group">
				<label>Seconds before new user can post</label>
				<input type="number" class="form-control" value="10" data-field="initialPostDelay">
			</div>
			<div class="form-group">
				<label>Number of seconds users are allowed to edit posts after posting. (0 disabled)</label>
				<input type="number" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="form-group">
				<label>Minimum Title Length</label>
				<input type="number" class="form-control" value="3" data-field="minimumTitleLength">
			</div>
			<div class="form-group">
				<label>Maximum Title Length</label>
				<input type="number" class="form-control" value="255" data-field="maximumTitleLength">
			</div>
			<div class="form-group">
				<label>Minimum Post Length</label>
				<input type="number" class="form-control" value="8" data-field="minimumPostLength">
			</div>
			<div class="form-group">
				<label>Minimum Post Length</label>
				<input type="number" class="form-control" value="32767" data-field="maximumPostLength">
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="trackIpPerPost"> <strong>Track IP Address for each post</strong>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Signature Settings</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="disableSignatures"> <strong>Disable signatures</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="signatures:disableLinks"> <strong>Disable links in signatures</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="signatures:disableImages"> <strong>Disable images in signatures</strong>
				</label>
			</div>
			<div class="form-group">
				<label>Maximum Signature Length</label>
				<input type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Chat Settings</div>
	<div class="panel-body">
		<form>
			<strong>Chat Message Inbox Size</strong><br /> <input type="text" class="form-control" value="250" data-field="chatMessageInboxSize">
		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Upload Settings</div>
	<div class="panel-body">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowFileUploads"> <strong>Allow users to upload regular files</strong>
				</label>
			</div>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="privateUploads"> <strong>Make uploaded files private</strong>
				</label>
			</div>
			<strong>Maximum File Size</strong><br /> <input type="text" class="form-control" value="2048" data-field="maximumFileSize"><br />

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowTopicsThumbnail"> <strong>Allow users to upload topic thumbnails</strong>
				</label>
			</div>
			<strong>Topic Thumb Size</strong><br /> <input type="text" class="form-control" value="120" data-field="topicThumbSize"> <br />

			<strong>Allowed file types, (ie png, pdf, zip). Leave empty to allow all.</strong><br /> <input type="text" class="form-control" value="" data-field="allowedFileExtensions"><br />

		</form>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading">Composer Settings</div>
	<div class="panel-body">
		<form>
			<p>
				The following settings govern the functionality and/or appearance of the post composer shown
				to users when they create new topics, or reply to existing topics.
			</p>
			<div class="checkbox">
				<label for="composer:showHelpTab">
					<input type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
					Show "Help" tab
				</label>
			</div>
			<div class="checkbox">
				<label for="composer:allowPluginHelp">
					<input type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
					Allow plugins to add content to the help tab
				</label>
			</div>
			<div class="form-group">
				<label for="composer:customHelpText">Custom Help Text</label>
				<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->