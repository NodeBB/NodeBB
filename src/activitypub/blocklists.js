'use strict';

const { parse } = require('csv-parse/sync');

const db = require('../database');
const request = require('../request');
const activitypub = module.parent.exports;

const blocklists = module.exports;

blocklists.list = async () => {
	const blocklists = await db.getSortedSetMembers('blocklists');
	const counts = await db.sortedSetsCard(blocklists.map(blocklist => `blocklist:${blocklist}`));

	return blocklists.map((url, idx) => {
		return { url, count: counts[idx] };
	});
};

blocklists.get = async (url) => {
	const domains = await db.getSortedSetMembers(`blocklist:${url}`);

	return {
		domains,
		count: domains.length,
	};
};

blocklists.add = async (url) => {
	const now = Date.now();

	await Promise.all([
		db.sortedSetAdd('blocklists', now, url),
		blocklists.refresh(url),
	]);
};

blocklists.remove = async (url) => {
	await Promise.all([
		db.sortedSetRemove('blocklists', url),
		db.delete(`blocklist:${url}`),
	]);
};

blocklists.refresh = async (url) => {
	activitypub.helpers.log(`[blocklists/refresh] Processing ${url}`);

	const { body: csv } = await request.get(url);
	let records;
	try {
		records = parse(csv, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		});
		if (!records.length) {
			return 0;
		}
	} catch (e) {
		return 0;
	}

	await db.sortedSetAdd(
		`blocklist:${url}`,
		records.map(entry => entry['#severity'] === 'silence' ? 2 : 1),
		records.map(entry => entry['#domain'])
	);

	return records.length;
};

blocklists.check = async (domain) => {
	const blocklists = await blocklists.list();
	let present = await db.isMemberOfSortedSets(blocklists.map(({ url }) => `blocklist:${url}`), domain);
	present = present.reduce((memo, present) => memo || present, false);

	return !present;
};
