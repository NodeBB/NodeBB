<script>
	require.config({
		baseUrl: "{relative_path}/src/modules",
		waitSeconds: 3,
		urlArgs: "{config.cache-buster}",
		paths: {
			'forum': '../client',
			'admin': '../admin',
			'vendor': '../../vendor',
			'mousetrap': '../../bower/mousetrap/mousetrap'
		}
	});
</script>