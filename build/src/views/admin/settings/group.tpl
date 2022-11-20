<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/group:general]]</div>
	<div class="col-sm-10 col-12">
		<form role="form">
			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="allowPrivateGroups">
				<label class="form-check-label">[[admin/settings/group:private-groups]]</label>
			</div>

			<p class="form-text">
				[[admin/settings/group:private-groups.help]]
			</p>
			<p class="form-text">
				[[admin/settings/group:private-groups.warning]]
			</p>

			<div class="form-check form-switch">
				<input class="form-check-input" type="checkbox" data-field="allowMultipleBadges">
				<label class="form-check-label">[[admin/settings/group:allow-multiple-badges]]</label>
			</div>

			<p class="form-text">
				[[admin/settings/group:allow-multiple-badges-help]]
			</p>
			<div class="mb-3">
				<label class="form-label" for="maximumGroupNameLength">[[admin/settings/group:max-name-length]]</label>
				<input id="maximumGroupNameLength" class="form-control" type="text" placeholder="255" data-field="maximumGroupNameLength" />
			</div>
			<div class="mb=3">
				<label class="form-label" for="maximumGroupTitleLength">[[admin/settings/group:max-title-length]]</label>
				<input id="maximumGroupTitleLength" class="form-control" type="text" placeholder="40" data-field="maximumGroupTitleLength" />
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/group:cover-image]]</div>
	<div class="col-sm-10 col-12">
		<form role="form">
			<label class="form-label" for="groups:defaultCovers"><strong>[[admin/settings/group:default-cover]]</strong></label>
			<p class="form-text">
				[[admin/settings/group:default-cover-help]]
			</p>
			<input type="text" class="form-control input-lg" id="groups:defaultCovers" data-field="groups:defaultCovers" data-field-type="tagsinput" value="/assets/images/cover-default.png" placeholder="https://example.com/group1.png, https://example.com/group2.png" />
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->