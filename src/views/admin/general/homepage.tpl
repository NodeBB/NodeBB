<div class="col-lg-9">	
	<div class="panel panel-default">
		<div class="panel-heading">Home Page</div>
		<div class="panel-body">
			<form>
				<label>Home Page Route</label>
				<select class="form-control" data-field="homePageRoute">
					<option value="categories">Categories</option>
					<option value="recent">Recent</option>
					<option value="popular">Popular</option>
				</select>
			</form>
		</div>
	</div>
</div>

<div class="col-lg-3 acp-sidebar">
	<div class="panel panel-default">
		<div class="panel-heading">Save Settings</div>
		<div class="panel-body">
			<button class="btn btn-primary btn-md" id="save">Save Changes</button>
			<button class="btn btn-warning btn-md" id="revert">Revert Changes</button>
		</div>
	</div>
</div>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>
