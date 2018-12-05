'use strict';

var cacheController = module.exports;

var utils = require('../../utils');

cacheController.get = function (req, res) {
	var postCache = require('../../posts/cache');
	var groupCache = require('../../groups').cache;
	var objectCache = require('../../database').objectCache;
	var localCache = require('../../cache');

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
			hits: utils.addCommas(String(postCache.hits)),
			misses: utils.addCommas(String(postCache.misses)),
			hitRatio: ((postCache.hits / (postCache.hits + postCache.misses) || 0)).toFixed(4),
		},
		groupCache: {
			length: groupCache.length,
			max: groupCache.max,
			itemCount: groupCache.itemCount,
			percentFull: ((groupCache.length / groupCache.max) * 100).toFixed(2),
			hits: utils.addCommas(String(groupCache.hits)),
			misses: utils.addCommas(String(groupCache.misses)),
			hitRatio: (groupCache.hits / (groupCache.hits + groupCache.misses)).toFixed(4),
		},
		localCache: {
			length: localCache.length,
			max: localCache.max,
			itemCount: localCache.itemCount,
			percentFull: ((localCache.length / localCache.max) * 100).toFixed(2),
			dump: req.query.debug ? JSON.stringify(localCache.dump(), null, 4) : false,
			hits: utils.addCommas(String(localCache.hits)),
			misses: utils.addCommas(String(localCache.misses)),
			hitRatio: (localCache.hits / (localCache.hits + localCache.misses)).toFixed(4),
		},
	};

	if (objectCache) {
		data.objectCache = {
			length: objectCache.length,
			max: objectCache.max,
			itemCount: objectCache.itemCount,
			percentFull: ((objectCache.length / objectCache.max) * 100).toFixed(2),
			hits: utils.addCommas(String(objectCache.hits)),
			misses: utils.addCommas(String(objectCache.misses)),
			hitRatio: (objectCache.hits / (objectCache.hits + objectCache.misses)).toFixed(4),
		};
	}

	res.render('admin/advanced/cache', data);
};
