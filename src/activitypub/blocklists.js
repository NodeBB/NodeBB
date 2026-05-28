'use strict';

const { parse } = require('csv-parse/sync');

const db = require('../database');
const request = require('../request');
const activitypub = module.parent.exports;

const Blocklists = module.exports;

const severityScore = {
	suspend: 1,
	silence: 2,
	filter: 3,
};

Blocklists.list = async () => {
	const blocklists = await db.getSortedSetMembers('blocklists');
	const counts = await db.sortedSetsCard(blocklists.map(blocklist => `blocklist:${blocklist}`));

	return blocklists.map((url, idx) => {
		return { url, count: counts[idx] };
	});
};

Blocklists.get = async (url) => {
	const domains = await db.getSortedSetMembers(`blocklist:${url}`);

	return {
		domains,
		count: domains.length,
	};
};

Blocklists.add = async (url) => {
	const now = Date.now();

	await Promise.all([
		db.sortedSetAdd('blocklists', now, url),
		Blocklists.refresh(url),
	]);
};

Blocklists.remove = async (url) => {
	await Promise.all([
		db.sortedSetRemove('blocklists', url),
		db.delete(`blocklist:${url}`),
		db.delete(`blocklist:${url}:severity`),
	]);
};

Blocklists.refresh = async (url) => {
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

	const severityMap = {};
	records.forEach((entry) => {
		severityMap[entry['#domain']] = entry['#severity'] || 'suspend';
	});

	await db.delete(`blocklist:${url}`);
	await db.sortedSetAdd(
		`blocklist:${url}`,
		records.map(entry => severityScore[severityMap[entry['#domain']]] ?? 1),
		records.map(entry => entry['#domain'])
	);

	await db.delete(`blocklist:${url}:severity`);
	await db.setObject(`blocklist:${url}:severity`, severityMap);

	return records.length;
};

Blocklists.check = async (domain) => {
	const blocklists = await Blocklists.list();
	let present = await db.isMemberOfSortedSets(blocklists.map(({ url }) => `blocklist:${url}`), domain);
	present = present.reduce((memo, present) => memo || present, false);

	if (!present) {
		return { allowed: true, severity: null, listUrl: null };
	}

	const keys = blocklists.map(({ url }) => `blocklist:${url}:severity`);
	const severityMaps = await db.getObjects(keys);

	let bestSeverity = null;
	let bestListUrl = null;

	blocklists.forEach(({ url }, idx) => {
		const severityMap = severityMaps[idx];
		if (severityMap && severityMap[domain]) {
			const score = severityScore[severityMap[domain]] ?? 1;
			if (bestSeverity === null || score < bestSeverity) {
				bestSeverity = score;
				bestListUrl = url;
			}
		}
	});

	return {
		allowed: false,
		severity: bestSeverity,
		listUrl: bestListUrl,
	};
};
