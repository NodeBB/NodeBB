'use strict';

const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, /** @type { import('webpack').Configuration } */ {
	mode: 'development',
	// devtool: 'eval-source-map',
});
