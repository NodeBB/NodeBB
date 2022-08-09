'use strict';

const cacheCreate = require('../cacheCreate');
const meta = require('../meta');
const helpers = require('./helpers');
const user = require('../user');

let cache; // cache created on first usage because meta.config not populated yet

exports.clearCache = function () {
	if (!cache) {
		return;
	}

	cache.clear();
};

exports.ratelimit = helpers.try(async (req, res, next) => {
	if (!cache) {
		// todo: replace this with ttlcache
		cache = cacheCreate({
			ttl: meta.config.uploadRateLimitCooldown * 1000,
		});
	}

	const { uid } = req;
	if (!meta.config.uploadRateLimitThreshold || (uid && await user.isAdminOrGlobalMod(uid))) {
		return next();
	}

	const count = (cache.peek(`${req.ip}:uploaded_file_count`) || 0) + req.files.files.length;
	if (count > meta.config.uploadRateLimitThreshold) {
		return next(new Error(['[[error:upload-ratelimit-reached]]']));
	}

	cache.set(`${req.ip}:uploaded_file_count`, count);
	next();
});

