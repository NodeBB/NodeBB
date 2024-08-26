'use strict';

const cacheController = module.exports;

const utils = require('../../utils');
const plugins = require('../../plugins');

cacheController.get = async function (req, res) {
	const postCache = require('../../posts/cache').getOrCreate();
	const groupCache = require('../../groups').cache;
	const { objectCache } = require('../../database');
	const localCache = require('../../cache');
	const uptimeInSeconds = process.uptime();
	function getInfo(cache) {
		return {
			length: cache.length,
			max: cache.max,
			maxSize: cache.maxSize,
			itemCount: cache.itemCount,
			percentFull: cache.name === 'post' ?
				((cache.length / cache.maxSize) * 100).toFixed(2) :
				((cache.itemCount / cache.max) * 100).toFixed(2),
			hits: utils.addCommas(String(cache.hits)),
			hitsPerSecond: (cache.hits / uptimeInSeconds).toFixed(2),
			misses: utils.addCommas(String(cache.misses)),
			hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
			enabled: cache.enabled,
			ttl: cache.ttl,
		};
	}
	let caches = {
		post: postCache,
		group: groupCache,
		local: localCache,
	};
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
		post: require('../../posts/cache').getOrCreate(),
		object: require('../../database').objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	};
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	if (!caches[req.query.name]) {
		return next();
	}

	const data = JSON.stringify(caches[req.query.name].dump(), null, 4);
	res.setHeader('Content-disposition', `attachment; filename= ${req.query.name}-cache.json`);
	res.setHeader('Content-type', 'application/json');
	res.write(data, (err) => {
		if (err) {
			return next(err);
		}
		res.end();
	});
};
