'use strict';

module.exports = function (opts) {
	const TTLCache = require('@isaacs/ttlcache');
	const pubsub = require('../pubsub');

	const ttlCache = new TTLCache(opts);

	const cache = {};
	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;
	const cacheSet = ttlCache.set;

	// expose properties
	const propertyMap = new Map([
		['max', 'max'],
		['itemCount', 'size'],
		['size', 'size'],
		['ttl', 'ttl'],
	]);
	propertyMap.forEach((ttlProp, cacheProp) => {
		Object.defineProperty(cache, cacheProp, {
			get: function () {
				return ttlCache[ttlProp];
			},
			configurable: true,
			enumerable: true,
		});
	});

	cache.has = (key) => {
		if (!cache.enabled) {
			return false;
		}

		return ttlCache.has(key);
	};

	cache.set = function (key, value, ttl) {
		if (!cache.enabled) {
			return;
		}
		const opts = {};
		if (ttl) {
			opts.ttl = ttl;
		}
		cacheSet.apply(ttlCache, [key, value, opts]);
	};

	cache.get = function (key) {
		if (!cache.enabled) {
			return undefined;
		}
		const data = ttlCache.get(key);
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
		pubsub.publish(`${cache.name}:ttlCache:del`, keys);
		keys.forEach(key => ttlCache.delete(key));
	};
	cache.delete = cache.del;

	cache.reset = function () {
		pubsub.publish(`${cache.name}:ttlCache:reset`);
		localReset();
	};
	cache.clear = cache.reset;

	function localReset() {
		ttlCache.clear();
		cache.hits = 0;
		cache.misses = 0;
	}

	pubsub.on(`${cache.name}:ttlCache:reset`, () => {
		localReset();
	});

	pubsub.on(`${cache.name}:ttlCache:del`, (keys) => {
		if (Array.isArray(keys)) {
			keys.forEach(key => ttlCache.delete(key));
		}
	});

	cache.getUnCachedKeys = function (keys, cachedData) {
		if (!cache.enabled) {
			return keys;
		}
		let data;
		let isCached;
		const unCachedKeys = keys.filter((key) => {
			data = cache.get(key);
			isCached = data !== undefined;
			if (isCached) {
				cachedData[key] = data;
			}
			return !isCached;
		});

		const hits = keys.length - unCachedKeys.length;
		const misses = keys.length - hits;
		cache.hits += hits;
		cache.misses += misses;
		return unCachedKeys;
	};

	cache.dump = function () {
		return Array.from(ttlCache.entries());
	};

	cache.peek = function (key) {
		return ttlCache.get(key, { updateAgeOnGet: false });
	};

	return cache;
};
