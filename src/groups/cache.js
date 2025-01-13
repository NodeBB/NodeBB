// SPDX-FileCopyrightText: 2013-2021 NodeBB Inc
//
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const cacheCreate = require('../cache/lru');

module.exports = function (Groups) {
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
