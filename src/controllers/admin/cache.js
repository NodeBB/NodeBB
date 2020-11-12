'use strict';

const cacheController = module.exports;

const utils = require('../../utils');

cacheController.get = function (req, res) {
	const postCache = require('../../posts/cache');
	const groupCache = require('../../groups').cache;
	const objectCache = require('../../database').objectCache;
	const localCache = require('../../cache');
	const headerFooterCache = require('../../middleware').headerFooterCache;

	function getInfo(cache) {
		return {
			length: cache.length,
			max: cache.max,
			itemCount: cache.itemCount,
			percentFull: ((cache.length / cache.max) * 100).toFixed(2),
			hits: utils.addCommas(String(cache.hits)),
			misses: utils.addCommas(String(cache.misses)),
			hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
			enabled: cache.enabled,
		};
	}

	const data = {
		postCache: getInfo(postCache),
		groupCache: getInfo(groupCache),
		localCache: getInfo(localCache),
		headerFooterCache: getInfo(headerFooterCache),
	};

	if (objectCache) {
		data.objectCache = getInfo(objectCache);
	}

	res.render('admin/advanced/cache', data);
};

cacheController.dump = function (req, res, next) {
	const caches = {
		post: require('../../posts/cache'),
		object: require('../../database').objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
		headerfooter: require('../../middleware').headerFooterCache,
	};
	if (!caches[req.query.name]) {
		return next();
	}

	const data = JSON.stringify(caches[req.query.name].dump(), null, 4);
	res.setHeader('Content-disposition', 'attachment; filename= ' + req.query.name + '-cache.json');
	res.setHeader('Content-type', 'application/json');
	res.write(data, function (err) {
		if (err) {
			return next(err);
		}
		res.end();
	});
};
