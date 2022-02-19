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
		nodebb: './build/public/src/client.js',
		admin: './build/public/src/admin/admin.js',
	},
	output: {
		filename: '[name].min.js',
		path: path.resolve(__dirname, 'build/webpack'),
		publicPath: `${relativePath}/assets/`,
	},
	watchOptions: {
		poll: 500,
		aggregateTimeout: 250,
	},
	resolve: {
		symlinks: false,
		modules: [
			'build/public/src/modules',
			'build/public/src',
			'node_modules',
			...activePlugins.map(p => `node_modules/${p}/node_modules`),
		],
		alias: {
			assets: path.resolve(__dirname, 'build/public'),
			forum: path.resolve(__dirname, 'build/public/src/client'),
			admin: path.resolve(__dirname, 'build/public/src/admin'),
			vendor: path.resolve(__dirname, 'public/vendor'),
			benchpress: path.resolve(__dirname, 'node_modules/benchpressjs'),
			Chart: path.resolve(__dirname, 'node_modules/chart.js'),
			Sortable: path.resolve(__dirname, 'node_modules/sortablejs'),
			'jquery-ui/widgets': path.resolve(__dirname, 'node_modules/jquery-ui/ui/widgets'),
			'ace/ace': path.resolve(__dirname, 'build/public/src/modules/ace-editor.js'),
		},
	},
};
