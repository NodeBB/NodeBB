'use strict';

const cacheController  = {} as any;

import utils = require('../../utils');
const plugins = require('../../plugins');

cacheController.get = async function (req, res) {
	const postCache = require('../../posts/cache');
	const groupCache = require('../../groups').cache;
	const { objectCache } = require('../../database').default.default;
	const localCache = require('../../cache');

	function getInfo(cache) {
		return {
			length: cache.length,
			max: cache.max,
			maxSize: cache.maxSize,
			itemCount: cache.itemCount,
			percentFull: cache.name === 'post' ?
				((cache.length / cache.maxSize) * 100).toFixed(2) :
				((cache.itemCount / cache.max) * 100).toFixed(2),
			// @ts-ignore
			hits: utils.addCommas(String(cache.hits)),
			// @ts-ignore
			misses: utils.addCommas(String(cache.misses)),
			hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
			enabled: cache.enabled,
			ttl: cache.ttl,
		} as any;
	}
	let caches = {
		post: postCache,
		group: groupCache,
		local: localCache,
	} as any;
	if (objectCache) {
		caches.object = objectCache;
	}
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	for (const [key, value] of Object.entries(caches)) {
		caches[key] = getInfo(value);
	}

	res.render('admin/advanced/cache', { caches });
};

cacheController.dump = async function (req, res, next) {
	let caches = {
		post: require('../../posts/cache'),
		object: require('../../database').objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	} as any;
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	// @ts-ignore
	if (!caches[req.query.name]) {
		return next();
	}
    // @ts-ignore
	const data = JSON.stringify(caches[req.query.name].dump(), null, 4);
	res.setHeader('Content-disposition', `attachment; filename= ${req.query.name}-cache.json`);
	res.setHeader('Content-type', 'application/json');
	res.write(data, (err: Error) => {
		if (err) {
			return next(err);
		}
		res.end();
	});
};
