'use strict';

module.exports = function (opts) {
	const { LRUCache } = require('lru-cache');
	const os = require('os');

	const pubsub = require('../pubsub');
	const tracker = require('./tracker');

	// lru-cache@7 deprecations
	const winston = require('winston');
	const chalk = require('chalk').default;

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
	if (!opts.name) {
		winston.warn(`[cache/init] ${chalk.white.bgRed.bold('WARNING')} The cache name is not set. This will be required in the future.\n ${new Error('t').stack} `);
	}

	const cache = {};
	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

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

	const invalidationVersions = new LRUCache({
		max: Math.max(10000, opts.max ? Math.floor(opts.max / 5) : 10000),
	});

	const inflight = new Map();

	cache.has = function (key) {
		if (!cache.enabled) {
			return false;
		}

		return lruCache.has(key);
	};

	cache.set = function (key, value, ttl) {
		if (!cache.enabled) {
			return;
		}
		const opts = {};
		if (ttl) {
			opts.ttl = ttl;
		}
		lruCache.set(key, value, opts);
	};

	cache.get = function (key, loader) {
		if (!cache.enabled) {
			return loader ?
				Promise.resolve().then(loader) :
				undefined;
		}
		const data = lruCache.get(key);
		if (data !== undefined) {
			cache.hits += 1;
			return data;
		}
		cache.misses += 1;
		if (!loader) {
			return undefined;
		}
		if (inflight.has(key)) {
			return inflight.get(key);
		}

		const version = getInvalidationVersion(key);
		const promise = Promise.resolve()
			.then(() => loader())
			.then((value) => {
				if (getInvalidationVersion(key) === version) {
					cache.set(key, value);
				}
				return value;
			}).finally(() => inflight.delete(key));

		inflight.set(key, promise);
		return promise;
	};

	cache.getMany = function (keys, loader) {
		if (!cache.enabled) {
			return loader ?
				Promise.resolve().then(() => loader(keys)) :
				keys.map(() => undefined);
		}

		const data = new Array(keys.length);
		const uncachedKeys = [];
		const uncachedIndexes = [];
		const pendingPromises = [];

		keys.forEach((key, index) => {
			const cachedValue = lruCache.get(key);

			if (cachedValue !== undefined) {
				cache.hits += 1;
				data[index] = cachedValue;
			} else if (inflight.has(key)) {
				// Re-use active in-flight promise for key
				cache.hits += 1;
				const keyPromise = inflight.get(key).then((val) => {
					data[index] = val;
				});
				pendingPromises.push(keyPromise);
			} else {
				cache.misses += 1;
				uncachedKeys.push(key);
				uncachedIndexes.push(index);
			}
		});

		// If no loader provided or all keys resolved synchronously from LRU cache
		if (!loader || (uncachedKeys.length === 0 && pendingPromises.length === 0)) {
			return data;
		}

		// Fast-path: no missing keys, but waiting on in-flight promises from other calls
		if (uncachedKeys.length === 0) {
			return Promise.all(pendingPromises).then(() => data);
		}

		// Execute loader for keys not currently cached or in-flight
		const loaderPromise = Promise.resolve()
			.then(() => loader(uncachedKeys, uncachedIndexes))
			.then((values) => {
				const resultMap = new Map();
				uncachedKeys.forEach((key, i) => {
					const value = values[i];
					resultMap.set(key, value);
				});
				return resultMap;
			});

		// Register individual keys into inflight map
		uncachedKeys.forEach((key, i) => {
			const targetIndex = uncachedIndexes[i];
			const version = getInvalidationVersion(key);

			const keyPromise = loaderPromise
				.then((resultMap) => {
					const value = resultMap.get(key);
					if (getInvalidationVersion(key) === version) {
						cache.set(key, value);
					}
					data[targetIndex] = value;
					return value;
				})
				.finally(() => {
					inflight.delete(key);
				});

			inflight.set(key, keyPromise);
			pendingPromises.push(keyPromise);
		});

		return Promise.all(pendingPromises).then(() => data);
	};

	cache.del = function (keys) {
		if (!cache.enabled) {
			return;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		localDel(keys);
		pubsub.publish(`${cache.name}:lruCache:del`, {
			id: `${os.hostname()}:${process.pid}`,
			keys,
		});
	};
	cache.delete = cache.del;

	cache.reset = function () {
		pubsub.publish(`${cache.name}:lruCache:reset`, {
			id: `${os.hostname()}:${process.pid}`,
		});
		localReset();
	};
	cache.clear = cache.reset;

	function localReset() {
		lruCache.clear();
		cache.hits = 0;
		cache.misses = 0;
	}

	function getInvalidationVersion(key) {
		return invalidationVersions.get(key) || 0;
	}

	function localDel(keys) {
		keys.forEach((key) => {
			invalidationVersions.set(key, getInvalidationVersion(key) + 1);
			lruCache.delete(key);
		});
	}

	pubsub.on(`${cache.name}:lruCache:reset`, ({ id }) => {
		if (id !== `${os.hostname()}:${process.pid}`) {
			localReset();
		}
	});

	pubsub.on(`${cache.name}:lruCache:del`, ({ id, keys }) => {
		if (id !== `${os.hostname()}:${process.pid}` && Array.isArray(keys)) {
			localDel(keys);
		}
	});

	cache.dump = function () {
		return {
			cache: lruCache.dump(),
			invalidationVersions: invalidationVersions.dump(),
		};
	};

	cache.peek = function (key) {
		return lruCache.peek(key);
	};

	tracker.addCache(opts.name, cache);
	return cache;
};
