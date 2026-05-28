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
	/* eslint-disable-next-line no-unused-vars */
	const { allowed, severity } = await activitypub.blocklists.check(domain);
	let { activitypubFilter: type, activitypubFilterList: list } = meta.config;

	if (!allowed && !type) {
		return false;
	}

	list = new Set(String(list).split('\n'));

	if (allowed) {
		return type ? list.has(domain) : true;
	}

	return type ? !list.has(domain) : false;
};
