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

	list = new Set(String(list).split('\n'));

	if (!type) {
		// type = 0: blocklist mode — deny if domain is on the list
		if (result.allowed) {
			return { ...result, allowed: !list.has(domain) };
		}

		return result;
	}

	// type = 1: allowlist mode — allow only if domain is on the list
	return { ...result, allowed: list.has(domain) };
};
