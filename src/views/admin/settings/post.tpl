<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Post Sorting</div>
	<div class="col-sm-10 col-xs-12">
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
	<div class="col-sm-2 col-xs-12 settings-header">Posting Restrictions</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="postDelay">Seconds between Posts</label>
				<input id="postDelay" type="text" class="form-control" value="10" data-field="postDelay">
			</div>
			<div class="form-group">
				<label for="newbiePostDelay">Seconds between Posts for New Users</label>
				<input id="newbiePostDelay" type="text" class="form-control" value="120" data-field="newbiePostDelay">
			</div>
			<div class="form-group">
				<label for="newbiePostDelayThreshold">Reputation threshold before this restriction is lifted</label>
				<input id="newbiePostDelayThreshold" type="text" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>
			<div class="form-group">
				<label for="initialPostDelay">Seconds before new user can post</label>
				<input id="initialPostDelay" type="text" class="form-control" value="10" data-field="initialPostDelay">
			</div>
			<div class="form-group">
				<label for="postEditDuration">Number of seconds users are allowed to edit posts after posting. (0 disabled)</label>
				<input id="postEditDuration" type="text" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="form-group">
				<label for="minimumTitleLength">Minimum Title Length</label>
				<input id="minimumTitleLength" type="text" class="form-control" value="3" data-field="minimumTitleLength">
			</div>
			<div class="form-group">
				<label for="maximumTitleLength">Maximum Title Length</label>
				<input id="maximumTitleLength" type="text" class="form-control" value="255" data-field="maximumTitleLength">
			</div>
			<div class="form-group">
				<label for="minimumPostLength">Minimum Post Length</label>
				<input id="minimumPostLength" type="text" class="form-control" value="8" data-field="minimumPostLength">
			</div>
			<div class="form-group">
				<label for="maximumPostLength">Maximum Post Length</label>
				<input id="maximumPostLength" type="text" class="form-control" value="32767" data-field="maximumPostLength">
			</div>
			<div class="form-group">
				<label for="topicStaleDays">Days until Topic is considered stale</label>
				<input id="topicStaleDays" type="text" class="form-control" value="60" data-field="topicStaleDays">
				<p class="help-block">
					If a topic is considered "stale", then a warning will be shown to users who attempt to reply
					to that topic.
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Teaser Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>Teaser Post</label>
				<select class="form-control" data-field="teaserPost">
					<option value="last-post">Last &ndash; Show the latest post, including the original post, if no replies</option>
					<option value="last-reply">Last &ndash; Show the latest reply, or a "No replies" placeholder if no replies</option>
					<option value="first">First</option>
				</select>
			</div>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Unread Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="unreadCutoff">Unread cutoff days</label>
				<input id="unreadCutoff" type="text" class="form-control" value="2" data-field="unreadCutoff">
			</div>
			<div class="form-group">
 				<label for="bookmarkthreshold">Minimum posts in topic before tracking last read</label>
 				<input id="bookmarkthreshold" type="text" class="form-control" value="5" data-field="bookmarkThreshold">
 			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Signature Settings</div>
	<div class="col-sm-10 col-xs-12">
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
	<div class="col-sm-2 col-xs-12 settings-header">Composer Settings</div>
	<div class="col-sm-10 col-xs-12">
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
	<div class="col-sm-2 col-xs-12 settings-header">IP Tracking</div>
	<div class="col-sm-10 col-xs-12">
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