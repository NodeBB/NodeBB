<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/group:general]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowPrivateGroups">
					<span class="mdl-switch__label"><strong>[[admin/settings/group:private-groups]]</strong></span>
				</label>
			</div>

			<p class="help-block">
				[[admin/settings/group:private-groups.help]]
			</p>
			<p class="help-block">
				[[admin/settings/group:private-groups.warning]]
			</p>

			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="allowMultipleBadges">
					<span class="mdl-switch__label"><strong>Allow Multiple Badges</strong></span>
				</label>
			</div>

			<p class="help-block">
				[[admin/settings/group:allow-multiple-badges-help]]
			</p>

			<label>[[admin/settings/group:max-name-length]]</label>
			<input class="form-control" type="text" placeholder="255" data-field="maximumGroupNameLength" />

			<label>[[admin/settings/group:max-title-length]]</label>
			<input class="form-control" type="text" placeholder="40" data-field="maximumGroupTitleLength" />
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/group:cover-image]]</div>
	<div class="col-sm-10 col-xs-12">
		<form role="form">
			<label for="groups:defaultCovers"><strong>[[admin/settings/group:default-cover]]</strong></label>
			<p class="help-block">
				[[admin/settings/group:default-cover-help]]
			</p>
			<input type="text" class="form-control input-lg" id="groups:defaultCovers" data-field="groups:defaultCovers" data-field-type="tagsinput" value="/assets/images/cover-default.png" placeholder="https://example.com/group1.png, https://example.com/group2.png" /><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->