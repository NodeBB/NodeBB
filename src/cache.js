'use strict';

var LRU = require('lru-cache');
var pubsub = require('./pubsub');

var cache = new LRU({
	max: 1000,
	maxAge: 0,
});
cache.hits = 0;
cache.misses = 0;

const cacheGet = cache.get;
const cacheDel = cache.del;
const cacheReset = cache.reset;

cache.get = function (key) {
	const data = cacheGet.apply(cache, [key]);
	if (data === undefined) {
		cache.misses += 1;
	} else {
		cache.hits += 1;
	}
	return data;
};

cache.del = function (key) {
	if (!Array.isArray(key)) {
		key = [key];
	}
	pubsub.publish('local:cache:del', key);
	key.forEach(key => cacheDel.apply(cache, [key]));
};

cache.reset = function () {
	pubsub.publish('local:cache:reset');
	localReset();
};

function localReset() {
	cacheReset.apply(cache);
	cache.hits = 0;
	cache.misses = 0;
}

pubsub.on('local:cache:reset', function () {
	localReset();
});

pubsub.on('local:cache:del', function (keys) {
	if (Array.isArray(keys)) {
		keys.forEach(key => cacheDel.apply(cache, [key]));
	}
});

module.exports = cache;
