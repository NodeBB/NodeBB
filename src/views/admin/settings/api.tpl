<!-- IMPORT admin/partials/settings/header.tpl -->

<form role="form" class="core-api-settings">
	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/api:tokens]]</div>
		<div class="col-sm-10 col-xs-12">
			<p class="lead">[[admin/settings/api:lead-text]]</p>
			<p>[[admin/settings/api:intro]]</p>
			<p>
				<a href="https://docs.nodebb.org/api">
					<i class="fa fa-external-link"></i>
					[[admin/settings/api:docs]]
				</a>
			</p>

			<div class="form-group" data-type="sorted-list" data-sorted-list="tokens" data-item-template="admin/partials/api/sorted-list/item" data-form-template="admin/partials/api/sorted-list/form">
				<input hidden="text" name="tokens">
				<ul data-type="list" class="list-group"></ul>
				<button type="button" data-type="add" class="btn btn-info">Create Token</button>
			</div>
		</div>
	</div>
</form>

<!-- IMPORT admin/partials/settings/footer.tpl -->