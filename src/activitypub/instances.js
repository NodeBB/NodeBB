'use strict';

const meta = require('../meta');
const db = require('../database');
const activitypub = module.parent.exports;

const Instances = module.exports;

Instances.log = async (domain) => {
	await db.sortedSetAdd('instances:lastSeen', Date.now(), domain);
};

Instances.getCount = async () => db.sortedSetCard('instances:lastSeen');

Instances.list = async () => db.getSortedSetMembers('instances:lastSeen');

Instances.isAllowed = async (domain) => {
	const result = await activitypub.blocklists.check(domain);
	let { activitypubFilter: type, activitypubFilterList: list } = meta.config;

	if (!result.allowed && !type) {
		return result;
	}

	list = new Set(String(list).split('\n'));

	if (result.allowed) {
		return { ...result, allowed: type ? list.has(domain) : true };
	}

	return { ...result, allowed: type ? !list.has(domain) : false };
};
