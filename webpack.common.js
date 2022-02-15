'use strict';

const path = require('path');
const url = require('url');
const nconf = require('nconf');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const activePlugins = require('./build/active_plugins.json');

let relativePath = nconf.get('relative_path');
if (relativePath === undefined) {
	nconf.file({
		file: path.resolve(__dirname, nconf.any(['config', 'CONFIG']) || 'config.json'),
	});

	const urlObject = url.parse(nconf.get('url'));
	relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
}

module.exports = {
	plugins: [
		new CleanWebpackPlugin(), // cleans dist folder
	],
	entry: {
		app: './public/src/app.js',
		// admin: './public/src/admin/admin.js',
	},
	output: {
		filename: '[name].bundle.js',
		chunkFilename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: `${relativePath}/dist/`,
	},
	watchOptions: {
		poll: 500,
		aggregateTimeout: 500,
	},
	resolve: {
		symlinks: false,
		modules: [
			'build/public/src/modules',
			'public/src',
			'public/src/modules',
			'public/src/client',
			'node_modules',
			...activePlugins.map(p => `node_modules/${p}/node_modules`),
		],
		alias: {
			assets: path.resolve(__dirname, 'build/public'),
			'forum/plugins': path.resolve(__dirname, 'build/public/src/modules/forum/plugins'),
			forum: path.resolve(__dirname, 'public/src/client'),
			'admin/plugins': path.resolve(__dirname, 'build/public/src/modules/admin/plugins'),
			admin: path.resolve(__dirname, 'public/src/admin'),
			vendor: path.resolve(__dirname, 'public/vendor'),
			benchpress: path.resolve(__dirname, 'node_modules/benchpressjs'),
		},
	},
};
