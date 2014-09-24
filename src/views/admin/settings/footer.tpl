
<span class="hidden" id="csrf" data-csrf="{csrf}"></span>
<button class="btn btn-primary" id="save">Save</button>

<script>
	require(['forum/admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>