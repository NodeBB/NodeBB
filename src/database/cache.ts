'use strict';

export default function (name) {
	const cacheCreate = require('../cache/lru').default;
	return cacheCreate({
		name: `${name}-object`,
		max: 40000,
		ttl: 0,
	});
};
