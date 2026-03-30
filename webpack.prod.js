'use strict';

const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const ProgressPlugin = require('progress-webpack-plugin');

const common = require('./webpack.common');

module.exports = merge(common, /** @type { import('webpack').Configuration } */ {
	mode: 'production',
	plugins: [
		new ProgressPlugin(true),
	],
	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				minify: TerserPlugin.esbuildMinify,
				terserOptions: {},
			}),
		],
	},
});
