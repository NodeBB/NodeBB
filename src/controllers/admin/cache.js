'use strict';

var cacheController = {};

cacheController.get = function(req, res, next) {
	var postCache = require('../../posts/cache');
	var groupCache = require('../../groups').cache;

	var avgPostSize = 0;
	var percentFull = 0;
	if (postCache.itemCount > 0) {
		avgPostSize = parseInt((postCache.length / postCache.itemCount), 10);
		percentFull = ((postCache.length / postCache.max) * 100).toFixed(2);
	}

	res.render('admin/advanced/cache', {
		postCache: {
			length: postCache.length,
			max: postCache.max,
			itemCount: postCache.itemCount,
			percentFull: percentFull,
			avgPostSize: avgPostSize,
			dump: req.query.debug ? JSON.stringify(postCache.dump(), null, 4) : false
		},
		groupCache: {
			length: groupCache.length,
			max: groupCache.max,
			itemCount: groupCache.itemCount,
			percentFull: ((groupCache.length / groupCache.max) * 100).toFixed(2),
			dump: req.query.debug ? JSON.stringify(groupCache.dump(), null, 4) : false
		}
	});
};


module.exports = cacheController;