'use strict';

import cacheCreate from '../cache/lru';

export const create = function (name) {
	return cacheCreate({
		name: `${name}-object`,
		max: 40000,
		ttl: 0,
	});
};
