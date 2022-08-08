'use strict';

const cacheCreate = require('../cacheCreate');
const meta = require('../meta');

module.exports = cacheCreate({
	name: 'post',
	max: meta.config.postCacheSize,
	ttl: 0,
	enabled: global.env === 'production',
});
