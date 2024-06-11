'use strict';

const cacheCreate = require('../cache/ttl');
const meta = require('../meta');
const helpers = require('./helpers');
const user = require('../user');

let cache;

exports.clearCache = function () {
	if (cache) {
		cache.clear();
	}
};

exports.ratelimit = helpers.try(async (req, res, next) => {
	const { uid } = req;
	if (!meta.config.uploadRateLimitThreshold || (uid && await user.isAdminOrGlobalMod(uid))) {
		return next();
	}
	if (!cache) {
		cache = cacheCreate({
			ttl: meta.config.uploadRateLimitCooldown * 1000,
		});
	}
	const count = (cache.get(`${req.ip}:uploaded_file_count`) || 0) + req.files.files.length;
	if (count > meta.config.uploadRateLimitThreshold) {
		return next(new Error(['[[error:upload-ratelimit-reached]]']));
	}
	cache.set(`${req.ip}:uploaded_file_count`, count);
	next();
});

