'use strict';

import { merge } from 'webpack-merge';
import common = require('./webpack.common');

module.exports =merge(common, {
	mode: 'development',
	// devtool: 'eval-source-map',
});
