'use strict';

module.exports = function (opts) {
	const LRU = require('lru-cache');
	const pubsub = require('./pubsub');

	const cache = new LRU(opts);

	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

	const cacheSet = cache.set;
	const cacheGet = cache.get;
	const cacheDel = cache.del;
	const cacheReset = cache.reset;

	cache.set = function (key, value) {
		if (!cache.enabled) {
			return;
		}
		cacheSet.apply(cache, [key, value]);
	};

	cache.get = function (key) {
		if (!cache.enabled) {
			return undefined;
		}
		const data = cacheGet.apply(cache, [key]);
		if (data === undefined) {
			cache.misses += 1;
		} else {
			cache.hits += 1;
		}
		return data;
	};

	cache.del = function (keys) {
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		pubsub.publish(cache.name + ':cache:del', keys);
		keys.forEach(key => cacheDel.apply(cache, [key]));
	};

	cache.reset = function () {
		pubsub.publish(cache.name + ':cache:reset');
		localReset();
	};

	function localReset() {
		cacheReset.apply(cache);
		cache.hits = 0;
		cache.misses = 0;
	}

	pubsub.on(cache.name + ':cache:reset', function () {
		localReset();
	});

	pubsub.on(cache.name + ':cache:del', function (keys) {
		if (Array.isArray(keys)) {
			keys.forEach(key => cacheDel.apply(cache, [key]));
		}
	});

	cache.getUnCachedKeys = function (keys, cachedData) {
		if (!cache.enabled) {
			return keys;
		}
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
