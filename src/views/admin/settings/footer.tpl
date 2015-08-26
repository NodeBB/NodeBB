</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">[[admin:footer.save_changes]]</i>
</button>

<script>
	require(['admin/settings'], function(Settings) {
		Settings.init();
		Settings.populateTOC();
	});
</script>
