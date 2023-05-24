<!-- IMPORT admin/partials/settings/header.tpl -->

<p class="lead">[[admin/settings/activitypub:intro-lead]]</p>
<p>[[admin/settings/activitypub:intro-body]]</p>

<hr />

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/activitypub:general]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check form-switch mb-3">
				<input class="form-check-input" type="checkbox" data-field="activityPubEnabled">
				<label class="form-check-label">[[admin/settings/activitypub:enabled]]</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
