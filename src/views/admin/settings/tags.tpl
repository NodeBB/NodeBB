<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/tags:tag]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="minimumTagsPerTopics">[[admin/settings/tags:min-per-topic]]</label>
				<input id="minimumTagsPerTopics" type="text" class="form-control" value="0" data-field="minimumTagsPerTopic">
			</div>
			<div class="form-group">
				<label for="maximumTagsPerTopics">[[admin/settings/tags:max-per-topic]]</label>
				<input id="maximumTagsPerTopics" type="text" class="form-control" value="5" data-field="maximumTagsPerTopic">
			</div>
			<div class="form-group">
				<label for="minimumTagLength">[[admin/settings/tags:min-length]]</label>
				<input id="minimumTagLength" type="text" class="form-control" value="3" data-field="minimumTagLength">
			</div>
			<div class="form-group">
				<label for="maximumTagLength">[[admin/settings/tags:max-length]]</label>
				<input id="maximumTagLength" type="text" class="form-control" value="15" data-field="maximumTagLength">
			</div>
		</form>
		<a href="{config.relative_path}/admin/manage/tags">[[admin/settings/tags:goto-manage]]</a>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/tags:related-topics]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="maximumRelatedTopics">[[admin/settings/tags:max-related-topics]]</label>
				<input id="maximumRelatedTopics" type="text" class="form-control" value="5" data-field="maximumRelatedTopics">
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->