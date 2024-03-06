<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<!-- general settings -->
			<div id="general" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:general]]</h5>

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
						<option value="recently_replied">[[admin/settings/post:sorting.recently-replied]]</option>
						<option value="recently_created">[[admin/settings/post:sorting.recently-created]]</option>
						<option value="most_posts">[[admin/settings/post:sorting.most-posts]]</option>
						<option value="most_votes">[[admin/settings/post:sorting.most-votes]]</option>
						<option value="most_views">[[admin/settings/post:sorting.most-views]]</option>
					</select>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="enablePostHistory" data-field="enablePostHistory" checked />
					<label class="form-check-label" for="enablePostHistory">[[admin/settings/post:enable-post-history]]</label>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="topicBacklinks" data-field="topicBacklinks">
					<label for="topicBacklinks" class="form-check-label">[[admin/settings/post:backlinks.enabled]]</label>
					<p class="form-text">[[admin/settings/post:backlinks.help]]</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input id="trackIPPerPost" class="form-check-input" type="checkbox" data-field="trackIpPerPost">
					<label for="trackIPPerPost" class="form-check-label">[[admin/settings/post:ip-tracking.each-post]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label" for="teaserPost">[[admin/settings/post:teaser]]</label>
					<select id="teaserPost" class="form-select" data-field="teaserPost">
						<option value="last-post">[[admin/settings/post:teaser.last-post]]</option>
						<option value="last-reply">[[admin/settings/post:teaser.last-reply]]</option>
						<option value="first">[[admin/settings/post:teaser.first]]</option>
					</select>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="showPostPreviewsOnHover" data-field="showPostPreviewsOnHover">
					<label for="showPostPreviewsOnHover" class="form-check-label">[[admin/settings/post:showPostPreviewsOnHover]]</label>
				</div>
			</div>

			<hr/>

			<!-- posting restrictions -->
			<div id="posting-restrictions" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:restrictions]]</h5>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-subcategories-per-page">
						[[admin/settings/post:restrictions.title-length]]
					</label>
					<div class="d-flex gap-3 align-items-center">
						<div class="d-flex gap-1 align-items-center">
							<label for="minimumTitleLength">[[admin/admin:min]]</label>
							<input id="minimumTitleLength" type="text" class="form-control text-end" value="3" data-field="minimumTitleLength" style="max-width: 80px;">
						</div>
						<div class="d-flex gap-1 align-items-center">
							<label for="maximumTitleLength">[[admin/admin:max]]</label>
							<input id="maximumTitleLength" type="text" class="form-control text-end" value="255" data-field="maximumTitleLength" style="max-width: 80px;">
						</div>
					</div>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-subcategories-per-page">
						[[admin/settings/post:restrictions.post-length]]
					</label>
					<div class="d-flex gap-3 align-items-center">
						<div class="d-flex gap-1 align-items-center">
							<label for="minimumPostLength">[[admin/admin:min]]</label>
							<input id="minimumPostLength" type="text" class="form-control text-end" value="8" data-field="minimumPostLength" style="max-width: 80px;">
						</div>
						<div class="d-flex gap-1 align-items-center">
							<label for="maximumPostLength">[[admin/admin:max]]</label>
							<input id="maximumPostLength" type="text" class="form-control text-end" value="32767" data-field="maximumPostLength" style="max-width: 80px;">
						</div>
					</div>
				</div>

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
			</div>

			<hr/>

			<!-- post queue settings -->
			<div id="post-queue" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:post-queue]]</h5>
				<div class="mb-3">
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" type="checkbox" data-field="postQueue">
						<label class="form-check-label">[[admin/settings/post:restrictions.post-queue]]</label>
					</div>
					<p class="form-text">
						[[admin/settings/post:restrictions.post-queue-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="postQueueReputationThreshold">[[admin/settings/post:restrictions.post-queue-rep-threshold]]</label>
					<input id="postQueueReputationThreshold" type="text" class="form-control" value="0" data-field="postQueueReputationThreshold">
				</div>

				<div class="mb-3">
					<label class="form-label" for="groupsExemptFromPostQueue">[[admin/settings/post:restrictions.groups-exempt-from-post-queue]]</label>
					<select id="groupsExemptFromPostQueue" class="form-select" multiple data-field="groupsExemptFromPostQueue">
						{{{ each groupsExemptFromPostQueue }}}
						<option value="{groupsExemptFromPostQueue.displayName}">{groupsExemptFromPostQueue.displayName}</option>
						{{{ end }}}
					</select>
				</div>
			</div>

			<hr/>

			<!-- timestamp settings -->
			<div id="timestamp" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:timestamp]]</h5>
				<div class="mb-3">
					<label class="form-label" for="timeagoCutoff">[[admin/settings/post:timestamp.cut-off]]</label>
					<input type="number" class="form-control" id="timeagoCutoff" data-field="timeagoCutoff"  />
					<p class="form-text">
						[[admin/settings/post:timestamp.cut-off-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="necroThreshold">[[admin/settings/post:timestamp.necro-threshold]]</label>
					<input type="number" class="form-control" id="necroThreshold" data-field="necroThreshold"  />
					<p class="form-text">
						[[admin/settings/post:timestamp.necro-threshold-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="incrementTopicViewsInterval">[[admin/settings/post:timestamp.topic-views-interval]]</label>
					<input type="number" class="form-control" id="incrementTopicViewsInterval" data-field="incrementTopicViewsInterval"  />
					<p class="form-text">
						[[admin/settings/post:timestamp.topic-views-interval-help]]
					</p>
				</div>
			</div>

			<hr/>

			<!-- unread & recent settings-->
			<div id="unread-recent-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:unread-and-recent]]</h5>

				<div class="mb-3">
					<label class="form-label" for="unreadCutoff">[[admin/settings/post:unread.cutoff]]</label>
					<input id="unreadCutoff" type="text" class="form-control" value="2" data-field="unreadCutoff">
				</div>
				<div class="mb-3">
					<label class="form-label" for="bookmarkthreshold">[[admin/settings/post:unread.min-track-last]]</label>
					<input id="bookmarkthreshold" type="text" class="form-control" value="5" data-field="bookmarkThreshold">
				</div>

				<div class="mb-3">
					<label class="form-label" for="recentMaxTopics">[[admin/settings/post:recent.max-topics]]</label>
					<input id="recentMaxTopics" type="text" class="form-control" value="200" data-field="recentMaxTopics">
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="disableRecentCategoryFilter">
					<label class="form-check-label">[[admin/settings/post:recent.categoryFilter.disable]]</label>
				</div>
			</div>

			<hr/>

			<!-- signature settings -->
			<div id="signature-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:signature]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="disableSignatures" data-field="disableSignatures">
					<label for="disableSignatures" class="form-check-label">[[admin/settings/post:signature.disable]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="signatures:disableLinks" data-field="signatures:disableLinks">
					<label for="signatures:disableLinks" class="form-check-label">[[admin/settings/post:signature.no-links]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="signatures:disableImages" data-field="signatures:disableImages">
					<label for="signatures:disableImages" class="form-check-label">[[admin/settings/post:signature.no-images]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="signatures:hideDuplicates" data-field="signatures:hideDuplicates">
					<label for="signatures:hideDuplicates" class="form-check-label">[[admin/settings/post:signature.hide-duplicates]]</label>
				</div>
				<div>
					<label class="form-label" for="maximumSignatureLength">[[admin/settings/post:signature.max-length]]</label>
					<input id="maximumSignatureLength" type="text" class="form-control" value="255" data-field="maximumSignatureLength">
				</div>
			</div>

			<hr/>

			<!-- composer settings -->
			<div id="composer-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/post:composer]]</h5>

				<p>
					[[admin/settings/post:composer-help]]
				</p>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="composer:showHelpTab" data-field="composer:showHelpTab" checked />
					<label class="form-check-label" for="composer:showHelpTab">[[admin/settings/post:composer.show-help]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="composer:allowPluginHelp" data-field="composer:allowPluginHelp" checked />
					<label class="form-check-label" for="composer:allowPluginHelp">[[admin/settings/post:composer.enable-plugin-help]]</label>
				</div>
				<div class="mb-3">
					<label class="form-label" for="composer:customHelpText">[[admin/settings/post:composer.custom-help]]</label>
					<textarea class="form-control" id="composer:customHelpText" data-field="composer:customHelpText" rows="5"></textarea>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
