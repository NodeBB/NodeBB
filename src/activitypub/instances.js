'use strict';

const meta = require('../meta');
const db = require('../database');
const activitypub = module.parent.exports;

const Instances = module.exports;

Instances.log = async (domain) => {
	await db.sortedSetAdd('instances:lastSeen', Date.now(), domain);
};

Instances.getCount = async () => db.sortedSetCard('instances:lastSeen');

Instances.isAllowed = async (domain) => {
	const allowed = await activitypub.blocklists.check(domain);
	let { activitypubFilter: type, activitypubFilterList: list } = meta.config;

	if (!allowed && !type) {
		return allowed;
	}

	list = new Set(String(list).split('\n'));
	// eslint-disable-next-line no-bitwise
	return allowed || (list.has(domain) ^ !type);
};
