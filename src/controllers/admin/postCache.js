'use strict';

var postCacheController = {};

postCacheController.get = function(req, res, next) {
	var cache = require('../../posts/cache');
	var avgPostSize = 0;
	var percentFull = 0;
	if (cache.itemCount > 0) {
		avgPostSize = parseInt((cache.length / cache.itemCount), 10);
		percentFull = ((cache.length / cache.max) * 100).toFixed(2);
	}

	res.render('admin/advanced/post-cache', {
		cache: {
			length: cache.length,
			max: cache.max,
			itemCount: cache.itemCount,
			percentFull: percentFull,
			avgPostSize: avgPostSize
		}
	});
};


module.exports = postCacheController;