require.config({
	baseUrl: config.relative_path + "/src/modules",
	waitSeconds: 7,
	urlArgs: "v=" + config['cache-buster'],
	paths: {
		'forum': '../client',
		'admin': '../admin',
		'vendor': '../../vendor',
		'plugins': '../../plugins'
	}
});
