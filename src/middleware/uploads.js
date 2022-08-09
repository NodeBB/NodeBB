'use strict';

const cacheCreate = require('../cacheCreate');
const meta = require('../meta');
const helpers = require('./helpers');
const user = require('../user');

const cache = cacheCreate({
	ttl: meta.config.uploadRateLimitCooldown * 1000,
});

exports.clearCache = function () {
	cache.clear();
};

exports.ratelimit = helpers.try(async (req, res, next) => {
	const { uid } = req;
	if (!meta.config.uploadRateLimitThreshold || (uid && await user.isAdminOrGlobalMod(uid))) {
		return next();
	}
	console.log(`${req.ip}:uploaded_file_count`, cache.peek(`${req.ip}:uploaded_file_count`));
	const count = (cache.peek(`${req.ip}:uploaded_file_count`) || 0) + req.files.files.length;
	console.log('count/max', count, meta.config.uploadRateLimitThreshold);
	if (count > meta.config.uploadRateLimitThreshold) {
		return next(new Error(['[[error:upload-ratelimit-reached]]']));
	}
	console.log('setting', count);
	cache.set(`${req.ip}:uploaded_file_count`, count);
	next();
});

