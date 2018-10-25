<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:sorting]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin/settings/post:sorting.post-default]]</label>
				<select class="form-control" data-field="topicPostSort">
					<option value="oldest_to_newest">[[admin/settings/post:sorting.oldest-to-newest]]</option>
					<option value="newest_to_oldest">[[admin/settings/post:sorting.newest-to-oldest]]</option>
					<option value="most_votes">[[admin/settings/post:sorting.most-votes]]</option>
				</select>
			</div>
			<div class="form-group">
				<label>[[admin/settings/post:sorting.topic-default]]</label>
				<select class="form-control" data-field="categoryTopicSort">
					<option value="oldest_to_newest">[[admin/settings/post:sorting.oldest-to-newest]]</option>
					<option value="newest_to_oldest">[[admin/settings/post:sorting.newest-to-oldest]]</option>
					<option value="most_posts">[[admin/settings/post:sorting.most-posts]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:length]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="row">
				<div class="col-xs-6">
					<div class="form-group">
						<label for="minimumTitleLength">[[admin/settings/post:restrictions.min-title-length]]</label>
						<input id="minimumTitleLength" type="text" class="form-control" value="3" data-field="minimumTitleLength">
					</div>
					<div class="form-group">
						<label for="maximumTitleLength">[[admin/settings/post:restrictions.max-title-length]]</label>
						<input id="maximumTitleLength" type="text" class="form-control" value="255" data-field="maximumTitleLength">
					</div>
				</div>
				<div class="col-xs-6">
					<div class="form-group">
						<label for="minimumPostLength">[[admin/settings/post:restrictions.min-post-length]]</label>
						<input id="minimumPostLength" type="text" class="form-control" value="8" data-field="minimumPostLength">
					</div>
					<div class="form-group">
						<label for="maximumPostLength">[[admin/settings/post:restrictions.max-post-length]]</label>
						<input id="maximumPostLength" type="text" class="form-control" value="32767" data-field="maximumPostLength">
					</div>
				</div>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:restrictions]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>

			<div class="form-group">
				<label for="postEditDuration">[[admin/settings/post:restrictions.seconds-edit-after]]</label>
				<input id="postEditDuration" type="text" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="form-group">
				<label for="postDeleteDuration">[[admin/settings/post:restrictions.seconds-delete-after]]</label>
				<input id="postDeleteDuration" type="text" class="form-control" value="0" data-field="postDeleteDuration">
			</div>
			<div class="form-group">
				<label for="preventTopicDeleteAfterReplies">[[admin/settings/post:restrictions.replies-no-delete]]</label>
				<input id="preventTopicDeleteAfterReplies" type="text" class="form-control" value="0" data-field="preventTopicDeleteAfterReplies">
			</div>

			<div class="form-group">
				<label for="topicStaleDays">[[admin/settings/post:restrictions.days-until-stale]]</label>
				<input id="topicStaleDays" type="text" class="form-control" value="60" data-field="topicStaleDays">
				<p class="help-block">
					[[admin/settings/post:restrictions.stale-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:restrictions-new]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="row">
				<div class="col-xs-6">
					<div class="form-group">
						<label for="newbiePostDelay">[[admin/settings/post:restrictions.seconds-between-new]]</label>
						<input id="newbiePostDelay" type="text" class="form-control" value="120" data-field="newbiePostDelay">
					</div>
				</div>
				<div class="col-xs-6">
					<div class="form-group">
					<label for="initialPostDelay">[[admin/settings/post:restrictions.seconds-defore-new]]</label>
					<input id="initialPostDelay" type="text" class="form-control" value="10" data-field="initialPostDelay">

					</div>
				</div>
			</div>
			<div class="form-group">
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input class="mdl-switch__input" type="checkbox" data-field="postQueue">
						<span class="mdl-switch__label"><strong>[[admin/settings/post:restrictions.post-queue]]</strong></span>
					</label>
				</div>
				<p class="help-block">
					[[admin/settings/post:restrictions.post-queue-help]]
				</p>
			</div>

			<div class="form-group">
				<label for="newbiePostDelayThreshold">[[admin/settings/post:restrictions.rep-threshold]]</label>
				<input id="newbiePostDelayThreshold" type="text" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:timestamp]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="timeagoCutoff">[[admin/settings/post:timestamp.cut-off]]</label>
				<input type="number" class="form-control" id="timeagoCutoff" data-field="timeagoCutoff"  />
				<p class="help-block">
					[[admin/settings/post:timestamp.cut-off-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Teaser</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label>[[admin/settings/post:teaser]]</label>
				<select class="form-control" data-field="teaserPost">
					<option value="last-post">[[admin/settings/post:teaser.last-post]]</option>
					<option value="last-reply">[[admin/settings/post:teaser.last-reply]]</option>
					<option value="first">[[admin/settings/post:teaser.first]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:unread]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="unreadCutoff">[[admin/settings/post:unread.cutoff]]</label>
				<input id="unreadCutoff" type="text" class="form-control" value="2" data-field="unreadCutoff">
			</div>
			<div class="form-group">
				<label for="bookmarkthreshold">[[admin/settings/post:unread.min-track-last]]</label>
				<input id="bookmarkthreshold" type="text" class="form-control" value="5" data-field="bookmarkThreshold">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:recent]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableRecentCategoryFilter">
					<span class="mdl-switch__label"><strong>[[admin/settings/post:recent.categoryFilter.disable]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:signature]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="disableSignatures">
					<span class="mdl-switch__label"><strong>[[admin/settings/post:signature.disable]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableLinks">
					<span class="mdl-switch__label"><strong>[[admin/settings/post:signature.no-links]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="signatures:disableImages">
					<span class="mdl-switch__label"><strong>[[admin/settings/post:signature.no-images]]</strong></span>
				</label>
			</div>
			<div class="form-group">
				<label>[[admin/settings/post:signature.max-length]]</label>
				<input type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:composer]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<p>
				[[admin/settings/post:composer-help]]
			</p>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:showHelpTab">
					<input class="mdl-switch__input" type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
					<span class="mdl-switch__label">[[admin/settings/post:composer.show-help]]</span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="composer:allowPluginHelp">
					<input class="mdl-switch__input" type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
					<span class="mdl-switch__label">[[admin/settings/post:composer.enable-plugin-help]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="composer:customHelpText">[[admin/settings/post:composer.custom-help]]</label>
				<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="enablePostHistory">
					<input class="mdl-switch__input" type="checkbox" id="enablePostHistory" data-field="enablePostHistory" checked />
					<span class="mdl-switch__label">[[admin/settings/post:enable-post-history]]</span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/post:ip-tracking]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="trackIpPerPost">
					<span class="mdl-switch__label"><strong>[[admin/settings/post:ip-tracking.each-post]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>
<!-- IMPORT admin/partials/settings/footer.tpl -->