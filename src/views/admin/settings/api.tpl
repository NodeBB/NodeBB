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

	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/api:settings]]</div>
		<div class="col-sm-10 col-xs-12">
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input id="requireHttps" class="mdl-switch__input" type="checkbox" name="requireHttps" />
					<span class="mdl-switch__label">[[admin/settings/api:require-https]]</span>
				</label>
			</div>
			<p class="help-block">[[admin/settings/api:require-https-caveat]]</p>
		</div>
	</div>

	<div class="row">
		<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/api:tokens]]</div>
		<div class="col-sm-10 col-xs-12">
			<div class="form-group" data-type="sorted-list" data-sorted-list="tokens" data-item-template="admin/partials/api/sorted-list/item" data-form-template="admin/partials/api/sorted-list/form">
				<input hidden="text" name="tokens">
				<ul data-type="list" class="list-group"></ul>
				<button type="button" data-type="add" class="btn btn-info">Create Token</button>
			</div>
		</div>
	</div>
</form>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>
