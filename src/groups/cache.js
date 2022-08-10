'use strict';

const cacheCreate = require('../cacheCreate');

module.exports = function (Groups) {
	Groups.cache = cacheCreate({
		name: 'group',
		max: 40000,
		maxAge: 0,
	});

	Groups.clearCache = function (uid, groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		const keys = groupNames.map(name => `${uid}:${name}`);
		Groups.cache.del(keys);
	};
};
