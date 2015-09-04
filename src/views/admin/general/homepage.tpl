<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:homepage.home_page]]</div>
	<div class="col-sm-10 col-xs-12">
		<p>
			[[admin:homepage.help]]
		</p>
		<form class="row">
			<div class="col-xs-6">
				<label>[[admin:homepage.home_page_route]]</label>
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
	<i class="material-icons">[[admin:homepage.save_changes]]</i>
</button>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>
