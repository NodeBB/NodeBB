<div class="row">
	<div class="col-xs-2">Home Page</div>
	<div class="col-xs-10">
		<p>
			Choose what page is shown when users navigate to the root URL of your forum.
		</p>
		<form class="row">
			<div class="col-xs-6">
				<label>Home Page Route</label>
				<select class="form-control" data-field="homePageRoute">
					<!-- BEGIN routes -->
					<option value="{routes.route}">{routes.name}</option>
					<!-- END routes -->
				</select>
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
