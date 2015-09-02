<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:tags.tag_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="privateTagListing">
					<span class="mdl-switch__label">[[admin:tags.make_the_tags_list_private]]</span>
				</label>
			</div>
			<div class="form-group">
				<label for="minimumTagsPerTopics">[[admin:tags.minimum_tags_per_topic]]</label>
				<input id="minimumTagsPerTopics" type="text" class="form-control" value="0" data-field="minimumTagsPerTopic">
			</div>
			<div class="form-group">
				<label for="maximumTagsPerTopics">[[admin:tags.maximum_tags_per_topic]]</label>
				<input id="maximumTagsPerTopics" type="text" class="form-control" value="5" data-field="maximumTagsPerTopic">
			</div>
			<div class="form-group">
				<label for="minimumTagLength">[[admin:tags.minimum_tag_length]]</label>
				<input id="minimumTagLength" type="text" class="form-control" value="3" data-field="minimumTagLength">
			</div>
			<div class="form-group">
				<label for="maximumTagLength">[[admin:tags.maximum_tag_length]]</label>
				<input id="maximumTagLength" type="text" class="form-control" value="15" data-field="maximumTagLength">
			</div>
		</form>[[admin:tags.click]]<a href="/admin/manage/tags">[[admin:tags.here]]</a>[[admin:tags.visit]]
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->