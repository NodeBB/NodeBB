'use strict';

const SocketCache = module.exports;

SocketCache.clear = async function () {
	require('../../posts/cache').reset();
	require('../../database').objectCache.reset();
	require('../../groups').cache.reset();
	require('../../cache').reset();
};
