'use strict';

module.exports = function (opts) {
	const { LRUCache } = require('lru-cache');
	const pubsub = require('../pubsub');

	// lru-cache@7 deprecations
	const winston = require('winston');
	const chalk = require('chalk');

	// sometimes we kept passing in `length` with no corresponding `maxSize`.
	// This is now enforced in v7; drop superfluous property
	if (opts.hasOwnProperty('length') && !opts.hasOwnProperty('maxSize')) {
		winston.warn(`[cache/init(${opts.name})] ${chalk.white.bgRed.bold('DEPRECATION')} ${chalk.yellow('length')} was passed in without a corresponding ${chalk.yellow('maxSize')}. Both are now required as of lru-cache@7.0.0.`);
		delete opts.length;
	}

	const deprecations = new Map([
		['stale', 'allowStale'],
		['maxAge', 'ttl'],
		['length', 'sizeCalculation'],
	]);
	deprecations.forEach((newProp, oldProp) => {
		if (opts.hasOwnProperty(oldProp) && !opts.hasOwnProperty(newProp)) {
			winston.warn(`[cache/init(${opts.name})] ${chalk.white.bgRed.bold('DEPRECATION')} The option ${chalk.yellow(oldProp)} has been deprecated as of lru-cache@7.0.0. Please change this to ${chalk.yellow(newProp)} instead.`);
			opts[newProp] = opts[oldProp];
			delete opts[oldProp];
		}
	});

	const lruCache = new LRUCache(opts);

	const cache = {};
	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;
	const cacheSet = lruCache.set;

	// expose properties while keeping backwards compatibility
	const propertyMap = new Map([
		['length', 'calculatedSize'],
		['calculatedSize', 'calculatedSize'],
		['max', 'max'],
		['maxSize', 'maxSize'],
		['itemCount', 'size'],
		['size', 'size'],
		['ttl', 'ttl'],
	]);
	propertyMap.forEach((lruProp, cacheProp) => {
		Object.defineProperty(cache, cacheProp, {
			get: function () {
				return lruCache[lruProp];
			},
			configurable: true,
			enumerable: true,
		});
	});

	cache.set = function (key, value, ttl) {
		if (!cache.enabled) {
			return;
		}
		const opts = {};
		if (ttl) {
			opts.ttl = ttl;
		}
		cacheSet.apply(lruCache, [key, value, opts]);
	};

	cache.get = function (key) {
		if (!cache.enabled) {
			return undefined;
		}
		const data = lruCache.get(key);
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
		pubsub.publish(`${cache.name}:lruCache:del`, keys);
		keys.forEach(key => lruCache.delete(key));
	};
	cache.delete = cache.del;

	cache.reset = function () {
		pubsub.publish(`${cache.name}:lruCache:reset`);
		localReset();
	};
	cache.clear = cache.reset;

	function localReset() {
		lruCache.clear();
		cache.hits = 0;
		cache.misses = 0;
	}

	pubsub.on(`${cache.name}:lruCache:reset`, () => {
		localReset();
	});

	pubsub.on(`${cache.name}:lruCache:del`, (keys) => {
		if (Array.isArray(keys)) {
			keys.forEach(key => lruCache.delete(key));
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
		return lruCache.dump();
	};

	cache.peek = function (key) {
		return lruCache.peek(key);
	};

	return cache;
};
