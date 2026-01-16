'use strict';

const meta = require('../meta');
const db = require('../database');

const Instances = module.exports;

Instances.log = async (domain) => {
	await db.sortedSetAdd('instances:lastSeen', Date.now(), domain);
};

Instances.getCount = async () => db.sortedSetCard('instances:lastSeen');

Instances.isAllowed = (domain) => {
	let { activitypubFilter: type, activitypubFilterList: list } = meta.config;
	list = new Set(String(list).split('\n'));
	// eslint-disable-next-line no-bitwise
	return list.has(domain) ^ !type;
};
