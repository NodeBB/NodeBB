'use strict';

const cacheCreate = require('../cache/lru');
const meta = require('../meta');

module.exports = cacheCreate({
	name: 'post',
	maxSize: meta.config.postCacheSize,
	sizeCalculation: function (n) { return n.length || 1; },
	ttl: 0,
	enabled: global.env === 'production',
});
