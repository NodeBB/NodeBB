'use strict';

module.exports = function (opts) {
	const { TTLCache } = require('@isaacs/ttlcache');
	const os = require('os');
	const winston = require('winston');
	const chalk = require('chalk').default;

	const pubsub = require('../pubsub');
	const tracker = require('./tracker');

	const ttlCache = new TTLCache(opts);
	if (!opts.name) {
		winston.warn(`[cache/init] ${chalk.white.bgRed.bold('WARNING')} The cache name is not set. This will be required in the future.\n ${new Error('t').stack} `);
	}

	const cache = {};
	cache.name = opts.name;
	cache.hits = 0;
	cache.misses = 0;
	cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

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

	const versions = new Map();

	cache.has = function (key) {
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
		ttlCache.set(key, value, opts);
	};

	cache.get = function (key, loader) {
		if (!cache.enabled) {
			return loader ?
				Promise.resolve().then(loader) :
				undefined;
		}
		const data = ttlCache.get(key);
		if (data !== undefined) {
			cache.hits += 1;
			return data;
		}
		cache.misses += 1;
		if (!loader) {
			return undefined;
		}
		const version = versions.get(key) || 0;
		return Promise.resolve()
			.then(() => loader())
			.then((value) => {
				if ((versions.get(key) || 0) === version) {
					cache.set(key, value);
				}
				return value;
			});
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
		const getManyVersions = new Map();

		keys.forEach((key, index) => {
			data[index] = cache.get(key);

			if (data[index] === undefined) {
				uncachedKeys.push(key);
				uncachedIndexes.push(index);
				getManyVersions.set(key, versions.get(key) || 0);
			}
		});

		if (!loader || !uncachedKeys.length) {
			return data;
		}

		return Promise.resolve()
			.then(() => loader(uncachedKeys))
			.then((values) => {
				uncachedKeys.forEach((key, index) => {
					const value = values[index];
					data[uncachedIndexes[index]] = value;
					if ((versions.get(key) || 0) === getManyVersions.get(key)) {
						cache.set(key, value);
					}
				});

				return data;
			});
	};

	cache.del = function (keys) {
		if (!cache.enabled) {
			return;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}

		localDel(keys);
		pubsub.publish(`${cache.name}:ttlCache:del`, { id: `${os.hostname()}:${process.pid}`, keys });
	};
	cache.delete = cache.del;

	cache.reset = function () {
		pubsub.publish(`${cache.name}:ttlCache:reset`, {
			id: `${os.hostname()}:${process.pid}`,
		});
		localReset();
	};
	cache.clear = cache.reset;

	function localReset() {
		ttlCache.clear();
		cache.hits = 0;
		cache.misses = 0;
	}

	function localDel(keys) {
		keys.forEach((key) => {
			versions.set(key, (versions.get(key) || 0) + 1);
			ttlCache.delete(key);
		});
	}

	pubsub.on(`${cache.name}:ttlCache:reset`, ({ id }) => {
		if (id !== `${os.hostname()}:${process.pid}`) {
			localReset();
		}
	});

	pubsub.on(`${cache.name}:ttlCache:del`, ({ id, keys }) => {
		if (id !== `${os.hostname()}:${process.pid}` && Array.isArray(keys)) {
			localDel(keys);
		}
	});

	cache.dump = function () {
		return Array.from(ttlCache.entries());
	};

	cache.peek = function (key) {
		return ttlCache.get(key, { updateAgeOnGet: false });
	};

	tracker.addCache(opts.name, cache);
	return cache;
};
