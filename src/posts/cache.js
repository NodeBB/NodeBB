'use strict';

var LRU = require('lru-cache');
var meta = require('../meta');

var cache = LRU({
	max: parseInt(meta.config.postCacheSize, 10) || 1048576,
	length: function (n) { return n.length; },
	maxAge: 0,
});

module.exports = cache;
