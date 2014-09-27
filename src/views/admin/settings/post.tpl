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

			<strong>Seconds between Posts</strong><br /> <input type="text" class="form-control" value="10" data-field="postDelay"><br />
			<strong>Seconds before new user can post</strong><br /> <input type="text" class="form-control" value="10" data-field="initialPostDelay"><br />
			<strong>Minimum Title Length</strong><br /> <input type="text" class="form-control" value="3" data-field="minimumTitleLength"><br />
			<strong>Maximum Title Length</strong><br /> <input type="text" class="form-control" value="255" data-field="maximumTitleLength"><br />
			<strong>Minimum Post Length</strong><br /> <input type="text" class="form-control" value="8" data-field="minimumPostLength"><br />
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="disableSignatures"> <strong>Disable signatures</strong>
				</label>
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
			<strong>Maximum File Size</strong><br /> <input type="text" class="form-control" value="2048" data-field="maximumFileSize"><br />

			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="allowTopicsThumbnail"> <strong>Allow users to upload topic thumbnails</strong>
				</label>
			</div>
			<strong>Topic Thumb Size</strong><br /> <input type="text" class="form-control" value="120" data-field="topicThumbSize">
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