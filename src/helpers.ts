'use strict';

export default  require('../../public/src/modules/helpers.common')(
	require('./utils'),
	require('benchpressjs'),
	require('nconf').get('relative_path'),
);
