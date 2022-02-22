// webpack config for webinstaller

'use strict';

const path = require('path');

module.exports = {
	mode: 'production',
	entry: {
		installer: './public/src/installer/install.js',
	},
	output: {
		filename: '[name].min.js',
		path: path.resolve(__dirname, 'build/webpack'),
		publicPath: `/assets/`,
	},
	resolve: {
		symlinks: false,
		modules: [
			'public/src',
			'node_modules',
		],
	},
};
