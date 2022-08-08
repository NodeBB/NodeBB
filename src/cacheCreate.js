'use strict';

module.exports = function (opts) {
	const LRU = require('lru-cache');
	const pubsub = require('./pubsub');

	// lru-cache@7 deprecations
	const winston = require('winston');
	const chalk = require('chalk');
	const deprecations = new Map([
		['stale', 'allowStale'],
		['maxAge', 'ttl'],
		['length', 'sizeCalculation'],
	]);
	deprecations.forEach((newProp, oldProp) => {
		if (opts.hasOwnProperty(oldProp) && !opts.hasOwnProperty(newProp)) {
			winston.warn(`[cache/init (${opts.name})] ${chalk.white.bgRed.bold('DEPRECATION')} The option ${chalk.yellow(oldProp)} has been deprecated as of lru-cache@7.0.0. Please change this to ${chalk.yellow(newProp)} instead.`);
			opts[newProp] = opts[oldProp];
			delete opts[oldProp];
		}
	});

	const cache = new LRU(opts);

	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

	const cacheSet = cache.set;
	const cacheGet = cache.get;
	const cacheDelete = cache.delete;
	const cacheClear = cache.clear;

	cache.set = function (key, value, maxAge) {
		if (!cache.enabled) {
			return;
		}
		cacheSet.apply(cache, [key, value, maxAge]);
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

	cache.delete = function (keys) {
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		pubsub.publish(`${cache.name}:cache:delete`, keys);
		keys.forEach(key => cacheDelete.apply(cache, [key]));
	};

	cache.clear = function () {
		pubsub.publish(`${cache.name}:cache:clear`);
		localClear();
	};

	function localClear() {
		cacheClear.apply(cache);
		cache.hits = 0;
		cache.misses = 0;
	}

	pubsub.on(`${cache.name}:cache:clear`, () => {
		localClear();
	});

	pubsub.on(`${cache.name}:cache:delete`, (keys) => {
		if (Array.isArray(keys)) {
			keys.forEach(key => cacheDelete.apply(cache, [key]));
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

	return cache;
};
