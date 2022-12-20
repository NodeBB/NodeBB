'use strict';

const cacheController = {} as any;

import utils from '../../utils';
import plugins from '../../plugins';
import postCache from '../../posts/cache';
import group from '../../groups';
import db from '../../database';
import localCache from '../../cache';

cacheController.get = async function (req, res) {
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
			misses: utils.addCommas(String(cache.misses)),
			hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0)).toFixed(4),
			enabled: cache.enabled,
			ttl: cache.ttl,
		};
	}
	let caches = {
		post: postCache,
		group: group.groupCache,
		local: localCache,
	} as any;
	if (db.objectCache) {
		caches.object = db.objectCache;
	}
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	for (const [key, value] of Object.entries(caches)) {
		caches[key] = getInfo(value);
	}

	res.render('admin/advanced/cache', { caches });
};

cacheController.dump = async function (req, res, next) {
	let caches = {
		post: postCache,
		object: db.objectCache,
		group: group.groupCache,
		local: localCache,
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

export default cacheController;