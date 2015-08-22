</div>

<div class="col-lg-3 acp-sidebar">
	<div class="panel panel-default">
		<div class="panel-heading">[[admin:footer.save_settings]]</div>
		<div class="panel-body">
			<button class="btn btn-primary btn-md" id="save">[[admin:footer.save_changes]]</button>
			<button class="btn btn-warning btn-md" id="revert">[[admin:footer.revert_changes]]</button>
		</div>
	</div>
</div>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>
