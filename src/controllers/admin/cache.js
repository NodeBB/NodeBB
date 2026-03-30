'use strict';

const cacheController = module.exports;

const tracker = require('../../cache/tracker');

cacheController.get = async function (req, res) {
	// force post cache to get created
	require('../../posts/cache').getOrCreate();

	const caches = await tracker.getCacheList();

	res.render('admin/advanced/cache', { caches });
};

cacheController.dump = async function (req, res, next) {
	const foundCache = await tracker.findCacheByName(req.query.name);
	if (!foundCache || !foundCache.dump) {
		return next();
	}

	const data = JSON.stringify(foundCache.dump(), null, 4);
	res.setHeader('Content-disposition', `attachment; filename= ${req.query.name}-cache.json`);
	res.setHeader('Content-type', 'application/json');
	res.write(data, (err) => {
		if (err) {
			return next(err);
		}
		res.end();
	});
};
