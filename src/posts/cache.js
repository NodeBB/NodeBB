'use strict';

const cacheCreate = require('../cache/lru');
const meta = require('../meta');

module.exports = cacheCreate({
	name: 'post',
	maxSize: meta.config.postCacheSize,
	sizeCalculation: function (n) { return n.length; },
	ttl: 0,
	enabled: global.env === 'production',
});
