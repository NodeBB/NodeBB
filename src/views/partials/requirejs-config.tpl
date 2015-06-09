<script>
	require.config({
		baseUrl: "{relative_path}/src/modules",
		waitSeconds: 3,
		urlArgs: "{cache-buster}",
		paths: {
			'forum': '../forum',
			'vendor': '../../vendor',
			'mousetrap': '../../bower/mousetrap/mousetrap'
		}
	});
</script>