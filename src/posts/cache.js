'use strict';

var LRU = require('lru-cache');
var meta = require('../meta');

var cache = LRU({
	max: parseInt(meta.config.postCacheSize, 10) || 5242880,
	length: function (n) { return n.length; },
	maxAge: 0,
});
cache.hits = 0;
cache.misses = 0;

module.exports = cache;
