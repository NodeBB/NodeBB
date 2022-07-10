<!-- IMPORT admin/partials/settings/header.tpl -->
<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/homepage:home-page]]</div>
	<div class="col-sm-10 col-xs-12">
		<p>
			[[admin/settings/homepage:description]]
		</p>
		<form class="row">
			<div class="col-sm-12">
				<label for="homePageRoute">[[admin/settings/homepage:home-page-route]]</label>
				<select id="homePageRoute" class="form-control" data-field="homePageRoute">
					<!-- BEGIN routes -->
					<option value="{routes.route}">{routes.name}</option>
					<!-- END routes -->
				</select>
				<div id="homePageCustom" style="display: none;">
					<br>
					<label for="homePageCustomInput">[[admin/settings/homepage:custom-route]]</label>
					<input id="homePageCustomInput" type="text" class="form-control" data-field="homePageCustom"/>
					<p class="help-block">[[user:custom_route_help]]</p>
				</div>
				<br>
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input class="mdl-switch__input" type="checkbox" data-field="allowUserHomePage">
						<span class="mdl-switch__label"><strong>[[admin/settings/homepage:allow-user-home-pages]]</strong></span>
					</label>
				</div>
				<br>
				<label for="homePageTitle">[[admin/settings/homepage:home-page-title]]</label>
				<input id="homePageTitle" class="form-control" type="text" data-field="homePageTitle" placeholder="[[pages:home]]">
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
