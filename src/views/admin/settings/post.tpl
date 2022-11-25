<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:sorting]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="topicPostSort">[[admin/settings/post:sorting.post-default]]</label>
				<select id="topicPostSort" class="form-select" data-field="topicPostSort">
					<option value="oldest_to_newest">[[admin/settings/post:sorting.oldest-to-newest]]</option>
					<option value="newest_to_oldest">[[admin/settings/post:sorting.newest-to-oldest]]</option>
					<option value="most_votes">[[admin/settings/post:sorting.most-votes]]</option>
				</select>
			</div>
			<div class="mb-3">
				<label class="form-label" for="categoryTopicSort">[[admin/settings/post:sorting.topic-default]]</label>
				<select id="categoryTopicSort" class="form-select" data-field="categoryTopicSort">
					<option value="oldest_to_newest">[[admin/settings/post:sorting.oldest-to-newest]]</option>
					<option value="newest_to_oldest">[[admin/settings/post:sorting.newest-to-oldest]]</option>
					<option value="most_posts">[[admin/settings/post:sorting.most-posts]]</option>
				</select>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:length]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="row">
				<div class="col-6">
					<div class="mb-3">
						<label class="form-label" for="minimumTitleLength">[[admin/settings/post:restrictions.min-title-length]]</label>
						<input id="minimumTitleLength" type="text" class="form-control" value="3" data-field="minimumTitleLength">
					</div>
					<div class="mb-3">
						<label class="form-label" for="maximumTitleLength">[[admin/settings/post:restrictions.max-title-length]]</label>
						<input id="maximumTitleLength" type="text" class="form-control" value="255" data-field="maximumTitleLength">
					</div>
				</div>
				<div class="col-6">
					<div class="mb-3">
						<label class="form-label" for="minimumPostLength">[[admin/settings/post:restrictions.min-post-length]]</label>
						<input id="minimumPostLength" type="text" class="form-control" value="8" data-field="minimumPostLength">
					</div>
					<div class="mb-3">
						<label class="form-label" for="maximumPostLength">[[admin/settings/post:restrictions.max-post-length]]</label>
						<input id="maximumPostLength" type="text" class="form-control" value="32767" data-field="maximumPostLength">
					</div>
				</div>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:restrictions]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="postDelay">[[admin/settings/post:restrictions.seconds-between]]</label>
				<input id="postDelay" type="text" class="form-control" value="10" data-field="postDelay">
			</div>
			<div class="mb-3">
				<label class="form-label" for="postEditDuration">[[admin/settings/post:restrictions.seconds-edit-after]]</label>
				<input id="postEditDuration" type="text" class="form-control" value="0" data-field="postEditDuration">
			</div>
			<div class="mb-3">
				<label class="form-label" for="postDeleteDuration">[[admin/settings/post:restrictions.seconds-delete-after]]</label>
				<input id="postDeleteDuration" type="text" class="form-control" value="0" data-field="postDeleteDuration">
			</div>
			<div class="mb-3">
				<label class="form-label" for="preventTopicDeleteAfterReplies">[[admin/settings/post:restrictions.replies-no-delete]]</label>
				<input id="preventTopicDeleteAfterReplies" type="text" class="form-control" value="0" data-field="preventTopicDeleteAfterReplies">
			</div>

			<div class="mb-3">
				<label class="form-label" for="topicStaleDays">[[admin/settings/post:restrictions.days-until-stale]]</label>
				<input id="topicStaleDays" type="text" class="form-control" value="60" data-field="topicStaleDays">
				<p class="form-text">
					[[admin/settings/post:restrictions.stale-help]]
				</p>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:restrictions-new]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="newbiePostDelayThreshold">[[admin/settings/post:restrictions.rep-threshold]]</label>
				<input id="newbiePostDelayThreshold" type="text" class="form-control" value="3" data-field="newbiePostDelayThreshold">
			</div>

			<div class="mb-3">
				<label class="form-label" for="newbiePostDelay">[[admin/settings/post:restrictions.seconds-between-new]]</label>
				<input id="newbiePostDelay" type="text" class="form-control" value="120" data-field="newbiePostDelay">
			</div>

			<div class="mb-3">
				<label class="form-label" for="initialPostDelay">[[admin/settings/post:restrictions.seconds-before-new]]</label>
				<input id="initialPostDelay" type="text" class="form-control" value="10" data-field="initialPostDelay">
			</div>

			<div class="mb-3">
				<label class="form-label" for="newbiePostEditDuration">[[admin/settings/post:restrictions.seconds-edit-after]]</label>
				<input id="newbiePostEditDuration" type="text" class="form-control" value="120" data-field="newbiePostEditDuration">
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:post-queue]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="row">
				<div class="col-sm-6">
					<div class="mb-3">
						<div class="form-check form-switch">
							<input class="form-check-input" type="checkbox" data-field="postQueue">
							<label class="form-check-label">[[admin/settings/post:restrictions.post-queue]]</label>
						</div>
						<p class="form-text">
							[[admin/settings/post:restrictions.post-queue-help]]
						</p>
					</div>
				</div>
				<div class="col-sm-6">
					<div class="mb-3">
						<label class="form-label" for="postQueueReputationThreshold">[[admin/settings/post:restrictions.post-queue-rep-threshold]]</label>
						<input id="postQueueReputationThreshold" type="text" class="form-control" value="0" data-field="postQueueReputationThreshold">
					</div>
				</div>
			</div>
			<div class="row">
				<div class="mb-3">
					<label class="form-label" for="groupsExemptFromPostQueue">[[admin/settings/post:restrictions.groups-exempt-from-post-queue]]</label>
					<select id="groupsExemptFromPostQueue" class="form-select" multiple data-field="groupsExemptFromPostQueue">
						<!-- BEGIN groupsExemptFromPostQueue -->
						<option value="{groupsExemptFromPostQueue.displayName}">{groupsExemptFromPostQueue.displayName}</option>
						<!-- END -->
					</select>
				</div>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:timestamp]]</div>
	<div class="col-sm-10 col-12">
		<form>
				<label for="timeagoCutoff">[[admin/settings/post:timestamp.cut-off]]</label>
				<input type="number" class="form-control" id="timeagoCutoff" data-field="timeagoCutoff"  />
				<p class="help-block">
					[[admin/settings/post:timestamp.cut-off-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="necroThreshold">[[admin/settings/post:timestamp.necro-threshold]]</label>
				<input type="number" class="form-control" id="necroThreshold" data-field="necroThreshold"  />
				<p class="help-block">
					[[admin/settings/post:timestamp.necro-threshold-help]]
				</p>
			</div>
			<div class="form-group">
				<label for="incrementTopicViewsInterval">[[admin/settings/post:timestamp.topic-views-interval]]</label>
				<input type="number" class="form-control" id="incrementTopicViewsInterval" data-field="incrementTopicViewsInterval"  />
				<p class="help-block">
					[[admin/settings/post:timestamp.topic-views-interval-help]]
				<label class="form-check-label">[[admin/settings/post:showPostPreviewsOnHover]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:unread]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="unreadCutoff">[[admin/settings/post:unread.cutoff]]</label>
				<input id="unreadCutoff" type="text" class="form-control" value="2" data-field="unreadCutoff">
			</div>
			<div>
				<label class="form-label" for="bookmarkthreshold">[[admin/settings/post:unread.min-track-last]]</label>
				<input id="bookmarkthreshold" type="text" class="form-control" value="5" data-field="bookmarkThreshold">
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:recent]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="recentMaxTopics">[[admin/settings/post:recent.max-topics]]</label>
				<input id="recentMaxTopics" type="text" class="form-control" value="200" data-field="recentMaxTopics">
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="disableRecentCategoryFilter">
				<label class="form-check-label">[[admin/settings/post:recent.categoryFilter.disable]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:signature]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="disableSignatures">
				<label class="form-check-label">[[admin/settings/post:signature.disable]]</label>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="signatures:disableLinks">
				<label class="form-check-label">[[admin/settings/post:signature.no-links]]</label>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="signatures:disableImages">
				<label class="form-check-label">[[admin/settings/post:signature.no-images]]</label>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="signatures:hideDuplicates">
				<label class="form-check-label">[[admin/settings/post:signature.hide-duplicates]]</label>
			</div>
			<div>
				<label class="form-label" for="maximumSignatureLength">[[admin/settings/post:signature.max-length]]</label>
				<input id="maximumSignatureLength" type="text" class="form-control" value="255" data-field="maximumSignatureLength">
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:composer]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<p>
				[[admin/settings/post:composer-help]]
			</p>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
				<label class="form-check-label" for="composer:showHelpTab">[[admin/settings/post:composer.show-help]]</label>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
				<label class="form-check-label" for="composer:allowPluginHelp">[[admin/settings/post:composer.enable-plugin-help]]</label>
			</div>
			<div class="mb-3">
				<label class="form-label" for="composer:customHelpText">[[admin/settings/post:composer.custom-help]]</label>
				<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
			</div>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" id="enablePostHistory" data-field="enablePostHistory" checked />
				<label class="form-check-label" for="enablePostHistory">[[admin/settings/post:enable-post-history]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:backlinks]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="topicBacklinks">
				<label class="form-check-label">[[admin/settings/post:backlinks.enabled]]</label>
				<p class="form-text">[[admin/settings/post:backlinks.help]]</p>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/post:ip-tracking]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="trackIpPerPost">
				<label class="form-check-label">[[admin/settings/post:ip-tracking.each-post]]</label>
			</div>
		</form>
	</div>
</div>
<!-- IMPORT admin/partials/settings/footer.tpl -->