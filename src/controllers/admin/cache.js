'use strict';

var cacheController = module.exports;

var utils = require('../../utils');

cacheController.get = function (req, res) {
	var postCache = require('../../posts/cache');
	var groupCache = require('../../groups').cache;
	var objectCache = require('../../database').objectCache;

	var avgPostSize = 0;
	var percentFull = 0;
	if (postCache.itemCount > 0) {
		avgPostSize = parseInt((postCache.length / postCache.itemCount), 10);
		percentFull = ((postCache.length / postCache.max) * 100).toFixed(2);
	}

	var data = {
		postCache: {
			length: postCache.length,
			max: postCache.max,
			itemCount: postCache.itemCount,
			percentFull: percentFull,
			avgPostSize: avgPostSize,
		},
		groupCache: {
			length: groupCache.length,
			max: groupCache.max,
			itemCount: groupCache.itemCount,
			percentFull: ((groupCache.length / groupCache.max) * 100).toFixed(2),
			dump: req.query.debug ? JSON.stringify(groupCache.dump(), null, 4) : false,
		},
	};

	if (objectCache) {
		data.objectCache = {
			length: objectCache.length,
			max: objectCache.max,
			itemCount: objectCache.itemCount,
			percentFull: ((objectCache.length / objectCache.max) * 100).toFixed(2),
			dump: req.query.debug ? JSON.stringify(objectCache.dump(), null, 4) : false,
			hits: utils.addCommas(String(objectCache.hits)),
			misses: utils.addCommas(String(objectCache.misses)),
			hitRatio: (objectCache.hits / (objectCache.hits + objectCache.misses)).toFixed(4),
		};
	}

	res.render('admin/advanced/cache', data);
};
