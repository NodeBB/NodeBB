'use strict';

let cache = null;

exports.getOrCreate = function () {
	if (!cache) {
		const cacheCreate = require('../cache/lru');
		const meta = require('../meta');
		cache = cacheCreate({
			name: 'post',
			maxSize: meta.config.postCacheSize,
			sizeCalculation: function (n) { return n.length || 1; },
			ttl: 0,
			enabled: global.env === 'production',
		});
	}

	return cache;
};

exports.del = function (pid) {
	if (cache) {
		cache.del(pid);
	}
};

exports.reset = function () {
	if (cache) {
		cache.reset();
	}
};
