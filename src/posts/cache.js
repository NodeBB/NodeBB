'use strict';

var LRU = require('lru-cache');
var meta = require('../meta');

var cache = new LRU({
	max: meta.config.postCacheSize,
	length: function (n) { return n.length; },
	maxAge: 0,
});
cache.hits = 0;
cache.misses = 0;

module.exports = cache;
