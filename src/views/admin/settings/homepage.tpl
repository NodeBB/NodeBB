<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/homepage:home-page]]</div>
	<div class="col-sm-10 col-xs-12">
		<p>
			[[admin/settings/homepage:description]]
		</p>
		<form class="row">
			<div class="col-sm-12">
				<label>[[admin/settings/homepage:home-page-route]]</label>
				<select class="form-control" data-field="homePageRoute">
					<!-- BEGIN routes -->
					<option value="{routes.route}">{routes.name}</option>
					<!-- END routes -->
				</select>
				<div id="homePageCustom" style="display: none;">
					<br>
					<label>[[admin/settings/homepage:custom-route]]</label>
					<input type="text" class="form-control" data-field="homePageCustom"/>
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
				<label>[[admin/settings/homepage:home-page-title]]</label>
				<input class="form-control" type="text" data-field="homePageTitle" placeholder="[[pages:home]]">
			</div>
		</form>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>
