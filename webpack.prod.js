'use strict';

const { merge } = require('webpack-merge');
const MinimizerPlugin = require('minimizer-webpack-plugin');
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
			new MinimizerPlugin({
				minify: MinimizerPlugin.esbuildMinify,
				minimizerOptions: {},
			}),
		],
	},
});
