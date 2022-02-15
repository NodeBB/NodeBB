'use strict';

const factory = require('./helpers.common');

define('helpers', ['utils', 'benchpressjs'], function (utils, Benchpressjs) {
	return factory(utils, Benchpressjs, config.relative_path);
});
