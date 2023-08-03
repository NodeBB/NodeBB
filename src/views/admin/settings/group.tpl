<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="general" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/group:general]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="allowPrivateGroups" data-field="allowPrivateGroups">
					<label for="allowPrivateGroups" class="form-check-label">[[admin/settings/group:private-groups]]</label>
					<p class="form-text">[[admin/settings/group:private-groups.help]]</p>
					<p class="form-text">[[admin/settings/group:private-groups.warning]]</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="allowMultipleBadges" data-field="allowMultipleBadges">
					<label for="allowMultipleBadges" class="form-check-label">[[admin/settings/group:allow-multiple-badges]]</label>
					<p class="form-text">[[admin/settings/group:allow-multiple-badges-help]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maximumGroupNameLength">[[admin/settings/group:max-name-length]]</label>
					<input id="maximumGroupNameLength" class="form-control" type="text" placeholder="255" data-field="maximumGroupNameLength" />
				</div>

				<div class="mb=3">
					<label class="form-label" for="maximumGroupTitleLength">[[admin/settings/group:max-title-length]]</label>
					<input id="maximumGroupTitleLength" class="form-control" type="text" placeholder="40" data-field="maximumGroupTitleLength" />
				</div>

			</div>

			<hr/>

			<div id="group-cover-image" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/group:cover-image]]</h5>

				<label class="form-label" for="groups:defaultCovers"><strong>[[admin/settings/group:default-cover]]</strong></label>
				<p class="form-text">
					[[admin/settings/group:default-cover-help]]
				</p>
				<input type="text" class="form-control input-lg" id="groups:defaultCovers" data-field="groups:defaultCovers" data-field-type="tagsinput" value="/assets/images/cover-default.png" />

			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
