'use strict';

const SocketCache  = {} as any;

import * as database from '../../database';
const db = database as any;
const plugins = require('../../plugins');

SocketCache.clear = async function (socket, data) {
	let caches = {
		post: require('../../posts/cache'),
		object: db.objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	} as any;
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].reset();
};

SocketCache.toggle = async function (socket, data) {
	let caches = {
		post: require('../../posts/cache'),
		object: db.objectCache,
		group: require('../../groups').cache,
		local: require('../../cache'),
	} as any;
	caches = await plugins.hooks.fire('filter:admin.cache.get', caches);
	if (!caches[data.name]) {
		return;
	}
	caches[data.name].enabled = data.enabled;
};
