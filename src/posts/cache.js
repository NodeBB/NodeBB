var	LRU = require('lru-cache');

var cache = LRU({
	max: 1048576,
	length: function (n) { return n.length; },
	maxAge: 1000 * 60 * 60
});



module.exports = cache;