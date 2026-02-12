'use strict';

const SocketCache = module.exports;

const db = require('../../database');
const plugins = require('../../plugins');

SocketCache.clear = async function (socket, data) {
	const caches = await getAvailableCaches();
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].reset();
};

SocketCache.toggle = async function (socket, data) {
	const caches = await getAvailableCaches();
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].enabled = data.enabled;
};

async function getAvailableCaches() {
	const caches = {
		post: require('../../posts/cache').getOrCreate(),
		object: db.objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
		notification: require('../../notifications').delayCache,
	};
	return await plugins.hooks.fire('filter:admin.cache.get', caches);
}