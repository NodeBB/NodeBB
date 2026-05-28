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
	const { allowed, severity } = await activitypub.blocklists.check(domain);
	const blocklistInfo = await activitypub.blocklists.getSeverityInfo(domain);

	let { activitypubFilter: type, activitypubFilterList: list } = meta.config;

	if (!allowed && !type) {
		return { allowed: false, severity, ...blocklistInfo };
	}

	list = new Set(String(list).split('\n'));

	if (allowed) {
		return { allowed: type ? list.has(domain) : true, severity, ...blocklistInfo };
	}

	return { allowed: type ? !list.has(domain) : false, severity, ...blocklistInfo };
};
