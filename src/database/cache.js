'use strict';

module.exports.create = function (name) {
	var LRU = require('lru-cache');
	var pubsub = require('../pubsub');

	var cache = new LRU({
		max: 20000,
		length: function () { return 1; },
		maxAge: 0,
	});

	cache.misses = 0;
	cache.hits = 0;

	pubsub.on(name + ':hash:cache:del', function (keys) {
		keys.forEach(key => cache.del(key));
	});

	pubsub.on(name + ':hash:cache:reset', function () {
		cache.reset();
	});

	cache.delObjectCache = function (keys) {
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		pubsub.publish(name + ':hash:cache:del', keys);
		keys.forEach(key => cache.del(key));
	};

	cache.resetObjectCache = function () {
		pubsub.publish(name + ':hash:cache:reset');
		cache.reset();
	};

	cache.getUnCachedKeys = function (keys, cachedData) {
		let data;
		let isCached;
		const unCachedKeys = keys.filter(function (key) {
			data = cache.get(key);
			isCached = data !== undefined;
			if (isCached) {
				cachedData[key] = data;
			}
			return !isCached;
		});

		var hits = keys.length - unCachedKeys.length;
		var misses = keys.length - hits;
		cache.hits += hits;
		cache.misses += misses;
		return unCachedKeys;
	};
	return cache;
};
