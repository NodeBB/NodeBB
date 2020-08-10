'use strict';

require.config({
	baseUrl: config.assetBaseUrl + '/src/modules',
	waitSeconds: 0,
	urlArgs: config['cache-buster'],
	paths: {
		forum: '../client',
		admin: '../admin',
		vendor: '../../vendor',
		plugins: '../../plugins',
	},
});
