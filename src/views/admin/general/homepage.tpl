<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Home Page</div>
	<div class="col-sm-10 col-xs-12">
		<p>
			Choose what page is shown when users navigate to the root URL of your forum.
		</p>
		<form class="row">
			<div class="col-sm-6">
				<label>Home Page Route</label>
				<select class="form-control" data-field="homePageRoute">
					<!-- BEGIN routes -->
					<option value="{routes.route}">{routes.name}</option>
					<!-- END routes -->
				</select>
				<div id="homePageCustom" style="display: none;">
					<br>
					<label>Custom Route</label>
					<input type="text" class="form-control" data-field="homePageCustom"/>
				</div>
				<br>
				<div class="checkbox">
					<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
						<input class="mdl-switch__input" type="checkbox" data-field="allowUserHomePage">
						<span class="mdl-switch__label"><strong>Allow User Home Pages</strong></span>
					</label>
				</div>
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
