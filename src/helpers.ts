'use strict';

module.exports = require('../public/src/modules/helpers.common')(
	require('./utils'),
	require('benchpressjs'),
	require('nconf').get('relative_path'),
);
