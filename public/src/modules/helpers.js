'use strict';

const factory = require('./helpers.common');

define('helpers', ['utils', 'benchpressjs', 'translator'], function (utils, Benchpressjs, translator) {
	return factory(utils, Benchpressjs, translator, config.relative_path);
});
