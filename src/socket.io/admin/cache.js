'use strict';

const SocketCache = module.exports;

const db = require('../../database');

SocketCache.clear = async function (socket, data) {
	if (data.name === 'post') {
		require('../../posts/cache').reset();
	} else if (data.name === 'object' && db.objectCache) {
		db.objectCache.reset();
	} else if (data.name === 'group') {
		require('../../groups').cache.reset();
	} else if (data.name === 'local') {
		require('../../cache').reset();
	}
};

SocketCache.toggle = async function (socket, data) {
	const caches = {
		post: require('../../posts/cache'),
		object: db.objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	};
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].enabled = data.enabled;
};
