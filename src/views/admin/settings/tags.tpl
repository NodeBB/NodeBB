<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="tag-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/tags:tag]]</h5>
				<div class="mb-3">
					<label class="form-label" for="systemTags">[[admin/settings/tags:system-tags]]</label>
					<input id="systemTags" type="text" class="form-control" value="" data-field="systemTags" data-field-type="tagsinput" />
					<p class="form-text">
						[[admin/settings/tags:system-tags-help]]
					</p>
				</div>
				<div class="mb-3">
					<label class="form-label" for="minimumTagsPerTopics">[[admin/settings/tags:min-per-topic]]</label>
					<input id="minimumTagsPerTopics" type="text" class="form-control" value="0" data-field="minimumTagsPerTopic">
				</div>
				<div class="mb-3">
					<label class="form-label" for="maximumTagsPerTopics">[[admin/settings/tags:max-per-topic]]</label>
					<input id="maximumTagsPerTopics" type="text" class="form-control" value="5" data-field="maximumTagsPerTopic">
				</div>
				<div class="mb-3">
					<label class="form-label" for="minimumTagLength">[[admin/settings/tags:min-length]]</label>
					<input id="minimumTagLength" type="text" class="form-control" value="3" data-field="minimumTagLength">
				</div>
				<div class="mb-3">
					<label class="form-label" for="maximumTagLength">[[admin/settings/tags:max-length]]</label>
					<input id="maximumTagLength" type="text" class="form-control" value="15" data-field="maximumTagLength">
				</div>

			</div>

			<hr/>

			<div id="related-topics" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/tags:related-topics]]</h5>
				<div class="mb-3">
					<label class="form-label" for="maximumRelatedTopics">[[admin/settings/tags:max-related-topics]]</label>
					<input id="maximumRelatedTopics" type="text" class="form-control" value="5" data-field="maximumRelatedTopics">
				</div>

			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
