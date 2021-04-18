'use strict';

const LRU = require('lru-cache');
const meta = require('../meta');
const helpers = require('./helpers');
const user = require('../user');
const controllerHelpers = require('../controllers/helpers');

const cache = new LRU({
	maxAge: meta.config.uploadRateLimitThreshold * 1000,
});

module.exports = function (middleware) {
	middleware.ratelimitUploads = helpers.try(async (req, res, next) => {
		const { uid } = req;
		if (!uid) {
			return controllerHelpers.notAllowed(req, res);
		}

		if (!meta.config.uploadRateLimitThreshold || await user.isAdminOrGlobalMod(req.uid)) {
			return next();
		}

		const count = (cache.peek(`${uid}:uploaded_file_count`) || 0) + req.files.files.length;
		if (count > meta.config.uploadRateLimitThreshold) {
			return next(new Error(['[[error:upload-ratelimit-reached]]']));
		}

		cache.set(`${uid}:uploaded_file_count`, count);
		next();
	});
};
