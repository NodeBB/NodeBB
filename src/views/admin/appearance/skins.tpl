<div id="skins" class="row skins">
	<div class="directory row" id="bootstrap_themes">
		<i class="fa fa-refresh fa-spin"></i> Loading Themes
	</div>
</div>

<div class="col-lg-3 acp-sidebar">
	<div class="panel panel-default">
		<div class="panel-heading">Revert to Default</div>
		<div class="panel-body">
			<p>This will remove any custom Bootswatch skin applied to your NodeBB, and restore the base theme.</p>
			<button class="btn btn-warning btn-md" id="revert_theme">Revert to Default</button>
		</div>
	</div>
</div>

<script>
	var bootswatchListener = function(data) {
		require(['admin/appearance/skins'], function(t) {
			t.render(data);
		});
	};
</script>
