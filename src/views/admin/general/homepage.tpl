<div class="col-lg-9">	
	<div class="panel panel-default">
		<div class="panel-heading">[[admin:homepage.home_page]]</div>
		<div class="panel-body">
			<form>
				<label>[[admin:homepage.home_page_route]]</label>
				<select class="form-control" data-field="homePageRoute">
					<!-- BEGIN routes -->
					<option value="{routes.route}">{routes.name}</option>
					<!-- END routes -->
				</select>
			</form>
		</div>
	</div>
</div>

<div class="col-lg-3 acp-sidebar">
	<div class="panel panel-default">
		<div class="panel-heading">[[admin:homepage.save_settings]]</div>
		<div class="panel-body">
			<button class="btn btn-primary btn-md" id="save">[[admin:homepage.save_changes]]</button>
			<button class="btn btn-warning btn-md" id="revert">[[admin:homepage.revert_changes]]</button>
		</div>
	</div>
</div>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>
