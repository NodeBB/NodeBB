<form role="form" class="core-api-settings">
	<p class="lead">[[admin/settings/api:lead-text]]</p>
	<p>[[admin/settings/api:intro]]</p>
	<p>
		<a href="https://docs.nodebb.org/api">
			<i class="fa fa-external-link"></i>
			[[admin/settings/api:docs]]
		</a>
	</p>

	<hr />

	<div class="row mb-4">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/api:settings]]</div>
		<div class="col-sm-10 col-12">
			<div class="form-check form-switch">
				<input id="requireHttps" class="form-check-input" type="checkbox" name="requireHttps" />
				<label class="form-check-label">[[admin/settings/api:require-https]]</label>
			</div>
			<p class="form-text">[[admin/settings/api:require-https-caveat]]</p>
		</div>
	</div>

	<div class="row mb-4">
		<div class="col-sm-2 col-12 settings-header">[[admin/settings/api:tokens]]</div>
		<div class="col-sm-10 col-12">
			<div class="form-group" data-type="sorted-list" data-sorted-list="tokens" data-item-template="admin/partials/api/sorted-list/item" data-form-template="admin/partials/api/sorted-list/form">
				<input type="hidden" name="tokens">
				<ul data-type="list" class="list-group mb-3"></ul>
				<button type="button" data-type="add" class="btn btn-info">Create Token</button>
			</div>
		</div>
	</div>
</form>

<!-- IMPORT admin/partials/save_button.tpl -->
