<!-- IMPORT admin/partials/settings/header.tpl -->
<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/homepage:home-page]]</div>
	<div class="col-sm-10 col-12">
		<p>
			[[admin/settings/homepage:description]]
		</p>
		<form class="row">
			<div class="col-sm-12">
				<div class="mb-3">
					<label class="form-label" for="homePageRoute">[[admin/settings/homepage:home-page-route]]</label>
					<select id="homePageRoute" class="form-select" data-field="homePageRoute">
						<!-- BEGIN routes -->
						<option value="{routes.route}">{routes.name}</option>
						<!-- END routes -->
					</select>
				</div>
				<div id="homePageCustom" class="mb-3" style="display: none;">
					<label class="form-label" for="homePageCustomInput">[[admin/settings/homepage:custom-route]]</label>
					<input id="homePageCustomInput" type="text" class="form-control" data-field="homePageCustom"/>
					<p class="form-text">[[user:custom_route_help]]</p>
				</div>

				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" data-field="allowUserHomePage">
					<label class="form-check-label">[[admin/settings/homepage:allow-user-home-pages]]</label>
				</div>
				<div>
					<label class="form-label" for="homePageTitle">[[admin/settings/homepage:home-page-title]]</label>
					<input id="homePageTitle" class="form-control" type="text" data-field="homePageTitle" placeholder="[[pages:home]]">
				</div>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
