'use strict';


const utils = require('../utils');

const cacheList = Object.create(null);

exports.addCache = function (key, cache) {
	if (Object.hasOwn(cacheList, key)) {
		throw new Error(`[cache/tracker] Cache with key "${key}" already exists. This will overwrite the existing cache.`);
	}
	cacheList[key] = cache;
};

exports.getCacheList = async function (sort = 'hits') {
	const result = [];
	for (const value of Object.values(cacheList)) {
		result.push(getInfo(value, process.uptime()));
	}

	result.sort((a, b) => b[sort].replace(/,/g, '') - a[sort].replace(/,/g, ''));

	result.sort(function (a, b) {
		const A = a[sort].replace(/,/g, '');
		const B = b[sort].replace(/,/g, '');
		const numA = parseFloat(A);
		const numB = parseFloat(B);

		if (!isNaN(numA) && !isNaN(numB)) {
			return numB - numA;
		}
		return B.localeCompare(A);
	});

	return result;
};

exports.findCacheByName = function (name) {
	return cacheList[name];
};

function getInfo(cache, uptimeInSeconds) {
	return {
		name: cache.name,
		length: cache.length,
		max: cache.max,
		maxSize: cache.maxSize,
		itemCount: cache.itemCount,
		percentFull: cache.name === 'post' ?
			((cache.length / cache.maxSize) * 100).toFixed(2) :
			((cache.itemCount / cache.max) * 100).toFixed(2),
		hits: utils.addCommas(String(cache.hits)),
		hitsPerSecond: (cache.hits / uptimeInSeconds).toFixed(2),
		misses: utils.addCommas(String(cache.misses)),
		hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
		enabled: cache.enabled,
		ttl: cache.ttl,
	};
}