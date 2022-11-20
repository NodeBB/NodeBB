'use strict';

const cacheCreate = require('../cache/ttl').default;
import meta from '../meta';
const helpers = require('./helpers').default;
import user from '../user';

console.log('ttl', meta.config);

const cache = cacheCreate({
	ttl: Infinity
	//ttl: meta.config.uploadRateLimitCooldown * 1000,
});

export const clearCache = function () {
	cache.clear();
};

export const ratelimit = helpers.try(async (req, res, next) => {
	const { uid } = req;
	if (!meta.config.uploadRateLimitThreshold || (uid && await user.isAdminOrGlobalMod(uid))) {
		return next();
	}

	const count = (cache.get(`${req.ip}:uploaded_file_count`) || 0) + req.files.files.length;
	if (count > meta.config.uploadRateLimitThreshold) {
		return next(new Error(['[[error:upload-ratelimit-reached]]'] as any));
	}
	cache.set(`${req.ip}:uploaded_file_count`, count);
	next();
});

