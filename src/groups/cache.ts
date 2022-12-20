'use strict';

import cacheCreate from '../cache/lru';

export default function (Groups) {
	Groups.cache = cacheCreate({
		name: 'group',
		max: 40000,
		ttl: 0,
	});

	Groups.clearCache = function (uid, groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		const keys = groupNames.map(name => `${uid}:${name}`);
		Groups.cache.del(keys);
	};
};
