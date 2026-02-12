'use strict';

const SocketCache = module.exports;

const tracker = require('../../cache/tracker');

SocketCache.clear = async function (socket, data) {
	const foundCache = await tracker.findCacheByName(data.name);
	if (foundCache && foundCache.reset) {
		foundCache.reset();
	}
};

SocketCache.toggle = async function (socket, data) {
	const foundCache = await tracker.findCacheByName(data.name);
	if (foundCache) {
		foundCache.enabled = data.enabled;
	}
};
