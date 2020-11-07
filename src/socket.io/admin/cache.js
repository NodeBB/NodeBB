'use strict';

const SocketCache = module.exports;

SocketCache.clear = async function () {
	require('../../posts/cache').reset();
	require('../../database').objectCache.reset();
	require('../../groups').cache.reset();
	require('../../cache').reset();
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
