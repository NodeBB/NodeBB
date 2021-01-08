'use strict';

const SocketCache = module.exports;

SocketCache.clear = async function (socket, data) {
	if (data.name === 'post') {
		require('../../posts/cache').reset();
	} else if (data.name === 'object') {
		require('../../database').objectCache.reset();
	} else if (data.name === 'group') {
		require('../../groups').cache.reset();
	} else if (data.name === 'local') {
		require('../../cache').reset();
	}
};

SocketCache.toggle = async function (socket, data) {
	const caches = {
		post: require('../../posts/cache'),
		object: require('../../database').objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	};
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].enabled = data.enabled;
};
