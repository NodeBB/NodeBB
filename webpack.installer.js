// webpack config for webinstaller

'use strict';

const path = require('path');

module.exports = {
	mode: 'production',
	entry: {
		installer: './public/src/installer/install.js',
	},
	output: {
		filename: '[name].bundle.js',
		chunkFilename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/dist/',
	},
	resolve: {
		symlinks: false,
		modules: [
			'public/src',
			'node_modules',
		],
	},
};
